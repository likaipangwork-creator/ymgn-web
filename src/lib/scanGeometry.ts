/** 将视频帧内坐标映射到页面上 object-fit: cover 的显示区域 */
export function mapVideoPointToDisplay(
  videoX: number,
  videoY: number,
  video: HTMLVideoElement,
  displayWidth: number,
  displayHeight: number
): { x: number; y: number } {
  const videoW = video.videoWidth
  const videoH = video.videoHeight
  if (!videoW || !videoH || !displayWidth || !displayHeight) {
    return { x: displayWidth / 2, y: displayHeight / 2 }
  }

  const videoAspect = videoW / videoH
  const displayAspect = displayWidth / displayHeight

  let scale: number
  let offsetX = 0
  let offsetY = 0

  if (videoAspect > displayAspect) {
    scale = displayHeight / videoH
    offsetX = (displayWidth - videoW * scale) / 2
  } else {
    scale = displayWidth / videoW
    offsetY = (displayHeight - videoH * scale) / 2
  }

  return {
    x: videoX * scale + offsetX,
    y: videoY * scale + offsetY,
  }
}

export function supportsMultiQRDetection(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}
