import { createDiagnosticCapabilityHandler } from '@/modules/scheduling/activation/runtime-diagnostic-capability-handler'
import { readDiagnosticEnvironment } from '@/modules/scheduling/activation/runtime-diagnostic-config'
import { createDiagnosticRouteAdapter } from '@/modules/scheduling/activation/runtime-diagnostic-route'

export const runtime = 'nodejs'
export const maxDuration = 45
export const dynamic = 'force-dynamic'

const handle = createDiagnosticRouteAdapter(createDiagnosticCapabilityHandler({
  environment: () => readDiagnosticEnvironment(process.env),
}))

export { handle as POST, handle as GET, handle as HEAD, handle as PUT, handle as PATCH, handle as DELETE, handle as OPTIONS }
