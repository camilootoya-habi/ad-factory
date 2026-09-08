# Renders de los presets

Copias reducidas a 720 px de los 6 estáticos que produce la fábrica, para poder compararlos
con `../referencias/` sin abrir el proyecto. Los archivos de verdad salen a 1080 px (o 1920
en 16:9) con `npm run render:presets` y se escriben en `.renders/`, que no se versiona.

| Archivo | Preset | Referencia |
| --- | --- | --- |
| `render-01.png` | `01-grafiti-muro` | `../referencias/ref-01.png` |
| `render-02.png` | `02-mujer-encontro-comprador` | `../referencias/ref-02.png` |
| `render-02-9x16.png` | el mismo preset en 9:16 (usa su `layouts["9x16"]`) | — |
| `render-03.png` | `03-casa-infografia` | `../referencias/ref-03.png` |
| `render-04.png` | `04-mujer-vende-tu-apto` | `../referencias/ref-04.png` |
| `render-05.png` | `05-celular-compra-o-vende` | `../referencias/ref-05.png` |
| `render-06.png` | `06-interior-listo-para-vender` | `../referencias/ref-06.png` |
