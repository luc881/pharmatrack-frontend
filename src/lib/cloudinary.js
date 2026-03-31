// ----------------------------------------------------------------------

/**
 * Sube una imagen a Cloudinary usando un upload preset sin firma (unsigned).
 * Acepta un File (desde disco) o una URL string (Cloudinary la descarga por su cuenta).
 * Requiere las variables de entorno:
 *   VITE_CLOUDINARY_CLOUD_NAME
 *   VITE_CLOUDINARY_UPLOAD_PRESET
 *
 * @param {File | string} source — archivo o URL remota
 * @returns {Promise<string>} URL pública de la imagen (secure_url)
 */
export async function uploadToCloudinary(source) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const formData = new FormData();
  formData.append('file', source); // Cloudinary acepta File o URL string
  formData.append('upload_preset', uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Error al subir la imagen a Cloudinary');
  }

  const data = await res.json();
  return data.secure_url;
}
