# Seguimiento de produccion

Aplicacion web para el seguimiento del piso de produccion de la muebleria.

## Donde vive cada cosa

- La raiz del repositorio: aplicacion publicada.
- Supabase: pedidos, perfiles, productos, plantillas e historial.
- GitHub: versiones del programa y publicacion automatica.

Publicar una version nueva no borra ni reinicia Supabase.

## Actualizaciones

Cada cambio enviado a la rama `main` reemplaza solamente los archivos de la
aplicacion en GitHub Pages. La base de datos de Supabase no forma parte del
repositorio y no se modifica durante la publicacion.

## Regla de seguridad

Nunca colocar una llave `service_role` dentro del proyecto. La llave
`publishable` de `supabase-config.js` esta disenada para aplicaciones web y su
acceso debe estar limitado por las politicas de Supabase.

## Recuperacion

- Si una version del programa falla, se puede volver a una version anterior en
  GitHub.
- Los datos operativos no dependen de la computadora local.
- Antes de cambiar tablas o politicas de Supabase se debe exportar un respaldo.
