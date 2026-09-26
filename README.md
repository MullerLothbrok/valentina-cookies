# Valentina Cookies Factory

Sitio web oficial de Valentina Cookies Factory.

Static HTML, CSS and JavaScript; no build or runtime dependencies.

- `index.html`: content and responsive image references.
- `styles.css`: desktop and mobile layout.
- `app.js`: saved cart, box form, navigation and accessible dialogs.
- `order.js`: catalog prices, state validation and WhatsApp message generation.
- `assets/photos/`: optimized WebP sizes and social sharing image.
- `assets/photo-map.json`: original source and image description mapping.
- Owner-provided originals are kept in the local archive; optimized copies are published.

Run `npm test` for order regression checks. Serve the repository with a static
HTTP server for browser verification; ES modules require HTTP, not `file://`.

Orders and box preferences are saved locally in the visitor's browser under
`valentina-order-v1`. Nothing is sent until the visitor opens WhatsApp and
chooses to send the message. Current prices always come from `order.js`.

