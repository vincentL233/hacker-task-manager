export const createHistoryArray = (length) => Array.from({ length }, () => 0)

export const adjustHistoryArray = (array, length) => {
  const safeArray = Array.isArray(array) ? [...array] : []
  if (safeArray.length > length) {
    return safeArray.slice(safeArray.length - length)
  }
  if (safeArray.length < length) {
    return Array.from({ length: length - safeArray.length }, () => 0).concat(safeArray)
  }
  return safeArray
}

export const appendHistory = (array, value, length) => {
  const base = Array.isArray(array) ? [...array, value] : [value]
  if (base.length > length) {
    base.splice(0, base.length - length)
  }
  if (base.length < length) {
    return Array.from({ length: length - base.length }, () => 0).concat(base)
  }
  return base
}
