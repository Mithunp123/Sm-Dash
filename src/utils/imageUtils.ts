export const buildImageUrl = (imageUrl: string | null | undefined) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const apiRoot = apiBase.replace(/\/api\/?$/, '');
  return `${apiRoot}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};
