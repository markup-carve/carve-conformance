export function structuralDiff(expected, actual, path = '') {
  if (Object.is(expected, actual)) return []
  if (!expected || !actual || typeof expected !== 'object' || typeof actual !== 'object' || Array.isArray(expected) !== Array.isArray(actual)) {
    return [{ path: path || '/', expected, actual }]
  }
  return [...new Set([...Object.keys(expected), ...Object.keys(actual)])].flatMap(key => {
    const next = `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`
    if (!Object.hasOwn(expected, key) || !Object.hasOwn(actual, key)) return [{ path: next, expected: expected[key], actual: actual[key] }]
    return structuralDiff(expected[key], actual[key], next)
  })
}

export function copyButton(label, value) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(typeof value === 'function' ? value() : value)
      button.textContent = 'Copied'
    } catch {
      button.textContent = 'Copy unavailable; select the text below'
    }
    setTimeout(() => { button.textContent = label }, 2000)
  })
  return button
}

export function updateQuery(values) {
  const url = new URL(location.href)
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') url.searchParams.delete(key)
    else url.searchParams.set(key, value)
  }
  history.replaceState(null, '', url)
}

export function restoreSelect(select, value) {
  if ([...select.options].some(option => option.value === value)) select.value = value
}
