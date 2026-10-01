import 'server-only'
import { getDomain } from 'tldts'
import { fetchPublicPage, normalizeWebsiteUrl, resolver, type LivePage } from '@/lib/platform-network'
import { matchesDomain, PLATFORM_RULE_VERSION, platformRules, type PlatformCheck } from '@/lib/platform-types'

export type HostObservation = { host: string; cnames: string[]; nameservers: string[]; page?: LivePage; error?: string; finalUrl?: string }
export function classifyPlatform(originalUrl: string, observations: HostObservation[]): PlatformCheck {
  const evidence: string[] = []
  let platform = 'Unknown'
  let confidence: PlatformCheck['confidence'] = 'unknown'
  const failed = observations.some((observation) => observation.error)
  const candidates: Array<{ platform: string; confidence: PlatformCheck['confidence'] }> = []
  for (const rule of platformRules) {
    const conflicts = observations.flatMap((observation) => rule.conflictingPageIdentifiers.filter(({ pattern }) => observation.page && pattern.test(observation.page.html)).map(({ label }) => `${observation.page!.finalUrl}: ${label}; no confirmed ${rule.platform} classification`))
    evidence.push(...conflicts)
    let ns = false, cname = false, live = false, paired = false
    for (const observation of observations) {
      for (const name of observation.nameservers) { if (matchesDomain(name, rule.nameserverDomains)) { ns = true; evidence.push(`${observation.host}: ${rule.platform} nameserver ${name} (DNS hosting only)`) } }
      const hasCname = observation.cnames.some((name) => matchesDomain(name, rule.cnameDomains))
      if (hasCname) { cname = true; evidence.push(`${observation.host}: ${rule.platform} CNAME ${observation.cnames.join(', ')}`) }
      const identifiers = rule.pageIdentifiers.filter(({ pattern }) => observation.page && pattern.test(observation.page.html))
      if (identifiers.length) { live = true; evidence.push(...identifiers.map(({ label }) => `${observation.page!.finalUrl}: ${label}`)) }
      if (hasCname && identifiers.length && new URL(observation.page!.finalUrl).hostname === observation.host) paired = true
      if (observation.page && new URL(observation.page.finalUrl).hostname !== observation.host) evidence.push(`${observation.host}: redirected to ${observation.page.finalUrl}`)
    }
    if ((ns || cname || live) && !conflicts.length) candidates.push({ platform: rule.platform, confidence: paired && !failed ? 'high' : 'medium' })
  }
  if (candidates.length === 1) { platform = candidates[0].platform; confidence = candidates[0].confidence }
  if (candidates.length > 1) evidence.push('Multiple supported platforms detected; classification remains unknown')
  evidence.push(...observations.filter((observation) => observation.error).map((observation) => `${observation.host}: ${observation.error}`))
  if (!evidence.length) evidence.push('No supported platform identifiers detected; this does not establish a different platform')
  return { platform, confidence, evidence, originalUrl, finalUrl: observations[0]?.page?.finalUrl || observations[0]?.finalUrl || null, checkedAt: new Date().toISOString(), ruleVersion: PLATFORM_RULE_VERSION }
}
export async function detectPlatform(input: string, dependencies = { fetchPage: fetchPublicPage, dns: resolver }) {
  const originalUrl = normalizeWebsiteUrl(input)
  const url = new URL(originalUrl)
  const root = getDomain(url.hostname, { allowPrivateDomains: true })
  if (!root) throw new Error('A public registrable website domain is required')
  const targets = [...new Map([originalUrl, `${url.protocol}//${root}/`, `${url.protocol}//www.${root}/`].map((value) => [new URL(value).hostname, value])).values()]
  // Retain the original path when it shares a hostname with a root/www target.
  targets[targets.findIndex((value) => new URL(value).hostname === url.hostname)] = originalUrl
  const signal = AbortSignal.timeout(12000)
  const observations = await Promise.all(targets.map(async (target) => {
    const host = new URL(target).hostname
    const observation: HostObservation = { host, cnames: [], nameservers: [] }
    const dns = dependencies.dns()
    await Promise.all([
      dns.resolveCname(host).then((values) => { observation.cnames = values }).catch((error) => { if (!['ENODATA', 'ENOTFOUND'].includes(error.code)) observation.error = 'CNAME lookup incomplete' }),
      dns.resolveNs(root).then((values) => { observation.nameservers = values }).catch((error) => { if (!['ENODATA', 'ENOTFOUND'].includes(error.code)) observation.error = 'Nameserver lookup incomplete' }),
      dependencies.fetchPage(target, signal).then((page) => { observation.page = page }).catch((error) => { observation.error = error instanceof Error ? error.message : 'Website inspection failed'; observation.finalUrl = error?.finalUrl }),
    ])
    return observation
  }))
  // A redirected destination needs its own DNS evidence, not the source host's CNAME.
  for (const destination of [...new Set(observations.flatMap((item) => item.page ? [new URL(item.page.finalUrl).hostname] : []))]) {
    if (observations.some((item) => item.host === destination)) continue
    const source = observations.find((item) => item.page && new URL(item.page.finalUrl).hostname === destination)!
    const extra: HostObservation = { host: destination, cnames: [], nameservers: [], page: source.page }
    try { extra.cnames = await dependencies.dns().resolveCname(destination) } catch (error) { if (!['ENODATA', 'ENOTFOUND'].includes((error as { code?: string }).code || '')) extra.error = 'Redirect destination CNAME lookup incomplete' }
    observations.push(extra)
  }
  return classifyPlatform(originalUrl, observations)
}
