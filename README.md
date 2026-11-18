# Valentina Cookies Factory

Sitio y panel de productos y pedidos de Valentina Cookies Factory. El catálogo público y el panel en `/admin/` usan las mismas funciones de Vercel y el mismo almacén privado de Vercel Blob.

Instalá las dependencias con `npm ci` y ejecutá `npm test`. Para probar la aplicación completa usá `vercel dev` con un almacén privado de desarrollo y una clave propia de ese entorno. En producción configurá el acceso a Blob desde el proyecto y `VALENTINA_ADMIN_PASSWORD` como secreto de al menos 16 caracteres.

Los precios e imágenes de `order.js` inicializan el catálogo. Las ediciones posteriores se guardan en Blob. Stock vacío significa por encargo, y cero significa agotado. El cliente registra una solicitud pendiente con nombre y ciudad y abre WhatsApp con su referencia. Valentina confirma el pedido desde el panel, descuenta las unidades con stock y puede marcar el envío. Cancelar un pedido confirmado repone esas unidades. El pago se coordina por WhatsApp.

## Entrega acompañada - noviembre de 2026

`informacion.html` identifica a la titular y describe el flujo real de solicitudes, pagos por WhatsApp y tratamiento de datos. Las solicitudes nuevas requieren `privacyAccepted: true`; guardan versión del aviso y fecha. No hay cobro online. Completar y validar con la titular correo de contacto, condiciones comerciales y datos alimentarios antes de considerar cerrado el cumplimiento legal.

El panel advierte al salir con cambios de contenido y mantiene borradores si vence la sesión. Ante una edición concurrente de producto permite cargar la última versión después de confirmar el descarte. El almacenamiento sigue usando escritura condicional por versión para evitar sobrescrituras; no reemplazarlo por escrituras sin `ifMatch`.

Las pruebas de dominio se ejecutan con `npm test`. La revisión de entrega también cubrió navegador móvil/tablet, carga de fotos, precios compartidos, pedidos/stock, secciones, sesiones vencidas y concurrencia en un almacén local de prueba. Los respaldos manuales y los archivos de acceso quedan fuera del repositorio. El sistema no tiene todavía respaldo automático periódico ni borrado automático de historial.
