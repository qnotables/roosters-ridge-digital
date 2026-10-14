import sharp from 'sharp'
import { SchedulingError } from './types'
export async function sanitizeBrandImage(bytes: Buffer, contentType: string) {
  if (!bytes.length || bytes.length > 2 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) throw new SchedulingError('invalid', 'Upload a PNG, JPEG or WebP image up to 2 MB. SVG and executable content are not accepted.')
  const signature = contentType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : contentType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
  if (!signature) throw new SchedulingError('invalid', 'File signature does not match the image type.')
  try {
    const image = sharp(bytes, { limitInputPixels: 16000000, animated: false, failOn: 'warning' }), metadata = await image.metadata()
    if (!metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096 || (metadata.pages ?? 1) > 1) throw new Error()
    return await image.rotate().resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true }).png().toBuffer()
  } catch { throw new SchedulingError('invalid', 'Image could not be safely decoded. Use a static raster image no larger than 4096 × 4096.') }
}
