export function labelFromPath(path: string) {
  const labels = path.split('/');
  if (labels.length === 0) {
    console.error('ARR is empty');
    return 'ERRORLABEL';
  }
  const label = labels[labels.length - 1];
  const parts = label.split('.');
  const part = parts[parts.length - 1];
  return part.replace(/(^\w{1})|(\s+\w{1})/g, (letter) => letter.toUpperCase());
}
