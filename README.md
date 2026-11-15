# Valentina Cookies Factory

Sitio y panel de productos y pedidos de Valentina Cookies Factory. El catálogo público y el panel en `/admin/` usan las mismas funciones de Vercel y el mismo almacén privado de Vercel Blob.

Instalá las dependencias con `npm ci` y ejecutá `npm test`. Para probar la aplicación completa usá `vercel dev` con un almacén privado de desarrollo y una clave propia de ese entorno. En producción configurá el acceso a Blob desde el proyecto y `VALENTINA_ADMIN_PASSWORD` como secreto de al menos 16 caracteres.

Los precios e imágenes de `order.js` inicializan el catálogo. Las ediciones posteriores se guardan en Blob. Stock vacío significa por encargo, y cero significa agotado. El cliente registra una solicitud pendiente con nombre y ciudad y abre WhatsApp con su referencia. Valentina confirma el pedido desde el panel, descuenta las unidades con stock y puede marcar el envío. Cancelar un pedido confirmado repone esas unidades. El pago se coordina por WhatsApp.
