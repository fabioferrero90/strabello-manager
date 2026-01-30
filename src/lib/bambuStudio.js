export const buildBambuStudioUrl = (fileUrl) => {
  if (!fileUrl) return ''

  const template = import.meta.env.VITE_BAMBU_STUDIO_PROTOCOL || 'bambustudio://open?file='
  const encodedUrl = encodeURIComponent(fileUrl)

  if (template.includes('{url}')) {
    return template.replace('{url}', encodedUrl)
  }

  return `${template}${encodedUrl}`
}

export const openInBambuStudio = (fileUrl) => {
  const targetUrl = buildBambuStudioUrl(fileUrl)
  if (!targetUrl) return

  window.location.href = targetUrl
}
