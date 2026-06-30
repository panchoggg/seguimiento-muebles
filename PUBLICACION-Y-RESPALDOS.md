# Publicacion y respaldos

## Operacion normal

La URL publica carga el programa desde GitHub Pages. Los datos se leen y
guardan en Supabase.

Una actualizacion del programa puede cambiar pantallas, validaciones y
funciones, pero no elimina pedidos porque no reemplaza la base de datos.

## Antes de cada actualizacion

1. Probar el cambio localmente.
2. No modificar ni ejecutar `supabase-setup.sql` otra vez.
3. Publicar la nueva version en GitHub.
4. Comprobar la URL publica en PC y celular.

## Cuando cambie la base de datos

Los cambios de estructura se hacen con archivos SQL numerados dentro de
`migrations`. Una migracion agrega o transforma datos; no debe borrar la tabla
principal.

Antes de ejecutarla:

1. Abrir Supabase.
2. Exportar la tabla `production_state` o copiar su fila `main`.
3. Ejecutar solamente la migracion nueva.
4. Abrir la aplicacion y comprobar pedidos, perfiles e historial.

## Que pasa si la computadora se rompe

La pagina sigue funcionando. GitHub conserva el programa y Supabase conserva
la informacion. Otra computadora puede descargar el proyecto y publicar
actualizaciones.

## Que pasa si una actualizacion sale mal

Se vuelve a publicar la version anterior desde GitHub. Los datos de Supabase
permanecen sin cambios.
