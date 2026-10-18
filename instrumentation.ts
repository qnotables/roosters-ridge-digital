import { assertStagingRuntimeConfiguration } from '@/lib/staging-isolation'

export function register() {
  assertStagingRuntimeConfiguration()
}
