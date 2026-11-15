# BakeMetrics

Aplicación web para repostería casera: recetas, costos reales, inventario, precios de venta con ITBMS (Panamá) y arte promocional para redes sociales.

Pensada para usarse desde el teléfono y publicarse gratis en GitHub Pages.

## Qué incluye

- **Recetario** con ingredientes, pasos, tiempos de horneado, etiquetas y favoritas.
- **Costos completos**: ingredientes, merma, mano de obra, empaque, gas/extras y gastos indirectos.
- **Precio de venta** automático por margen (o precio manual) con ITBMS configurable y redondeo a $0.05, $0.10, $0.25, etc.
- **Escalado** de tandas: 0.5×, 1×, 2×, 3× o la cantidad exacta de unidades que quieras producir.
- **Inventario** con existencias, mínimos, alertas de reposición y valor del inventario.
- **Compras** manuales o leyendo una foto de factura (OCR) para actualizar precios y stock.
- **Horneadas**: registra una tanda y descuenta los ingredientes del inventario.
- **Promociones**: genera imágenes de 1080×1080, 1080×1920 y 1080×1350 con tu marca, precio y datos de contacto; descárgalas o compártelas desde el teléfono.
- **Datos locales**: todo se guarda en el navegador (`localStorage`). Incluye exportar/importar respaldo JSON y reiniciar datos.
- **PWA**: se puede instalar en el teléfono y funciona sin conexión después de la primera visita.

## Cómo correrlo en tu computadora

Requisitos: Node.js 20.19+ o 22.12+.

```bash
npm install
npm run dev
```

Abre la dirección que muestra Vite (por defecto `http://localhost:5173`).

Otros comandos:

```bash
npm run typecheck   # revisa TypeScript
npm run build       # compila a dist/
npm run preview     # sirve dist/ localmente
```

## Publicarlo en GitHub Pages

El repositorio ya trae el flujo `.github/workflows/deploy.yml`:

1. Sube el proyecto a GitHub en la rama `main`.
2. En el repositorio ve a **Settings → Pages** y elige **Source: GitHub Actions**.
3. Cada push a `main` compila y publica el sitio.
4. La URL queda como `https://<usuario>.github.io/BakeMetrics/`.

La app usa `HashRouter` y rutas relativas (`base: './'`), así que funciona tanto en la raíz del dominio como en una subcarpeta, sin configuración extra.

## Precios, margen e ITBMS

- **Costo por unidad** = costo total de la tanda ÷ unidades producidas.
- **Precio automático** = costo por unidad ÷ (1 − margen deseado), y luego se le suma el ITBMS si la receta lo tiene activo.
- El **margen real** y el **markup** se calculan sobre el precio sin impuesto, para que no te engañe el ITBMS.
- ITBMS por defecto: **7%** (editable en Ajustes y activable por receta).
- Redondeo por defecto: **$0.25**.
- Si un ingrediente no tiene precio, aparece una alerta y el costo se marca como incompleto. Los ingredientes marcados como **sin costo** (por ejemplo, agua) no generan esa alerta.

## Respaldo de datos

Los datos viven en el navegador de cada dispositivo. Para no perderlos:

- **Ajustes → Exportar respaldo** descarga un JSON.
- **Ajustes → Importar respaldo** lo restaura en otro teléfono o navegador.
- Instalar la app como PWA no sincroniza datos entre dispositivos: cada uno mantiene su propio respaldo.

## Fotos y OCR

El lector de facturas usa `tesseract.js` y descarga el modelo de idioma la primera vez, así que necesita conexión a internet. El resultado es una **sugerencia editable**: tú confirmas cada línea y la asignas a un ingrediente antes de guardar la compra.

## Estructura del proyecto

```
src/
  components/   UI reutilizable (botones, hojas, formularios, iconos)
  data/         Datos iniciales de ingredientes y recetas
  lib/          Costos, unidades, OCR, generación de imágenes, utilidades
  pages/        Recetario, receta, inventario, compras, promo y ajustes
  store/        Estado global y persistencia en localStorage
  types.ts      Modelos de datos
```

## Notas

- Los precios iniciales de ingredientes son **referencias de Panamá**; confírmalos con tus facturas para que los costos sean reales.
- La marca, colores, Instagram y WhatsApp se editan en **Ajustes**.
- Nada se envía a un servidor: recetas, fotos y costos se quedan en tu dispositivo.
