# Refuerzo de concurrencia en Go

Recurso didáctico interactivo para la asignatura **Programación Orientada a Objetos (IFT 365)** de la Universidad
Internacional del Ecuador. Refuerza la semana 13 del sílabo (manejo de concurrencia) mediante un juego de ciudad
abierta, *Ciudad Goroutine*, en el que cada misión es un reto de lógica con código de Go.

**Acceso:** https://mariadsalazar.github.io/refuerzo-concurrencia-go/

## Objetivos de aprendizaje

Al completar la actividad, el estudiante habrá reforzado su capacidad para:

1. Seguir en el tiempo la ejecución de varias goroutines y anticipar lo que un programa imprime.
2. Repartir tareas entre goroutines para reducir el tiempo total.
3. Coordinar goroutines con `sync.WaitGroup`.
4. Reconocer una condición de carrera y proteger los datos compartidos con `sync.Mutex`.
5. Anticipar el efecto de un `panic` en una goroutine y ubicar correctamente el `recover`.
6. Interpretar el comportamiento de un servicio web concurrente.

## Contenidos

| Capítulo | Tema | Misiones | Razonamiento |
|---|---|---|---|
| 1 | Goroutines y tiempo | 2 | Orden de la salida; reparto de tareas |
| 2 | `WaitGroup` | 2 | Cálculo de goroutines pendientes; armado de un programa |
| 3 | `Mutex` | 2 | Intercalado de pasos; ubicación de `Lock` y `Unlock` |
| 4 | `panic` y `recover` | 2 | Orden de la salida; ubicación del bloque de recuperación |
| 5 | Servicio web | 2 | Respuesta a una serie de solicitudes; cálculo de tiempos y totales |

Las misiones con programa se verificaron con Go 1.27. En los retos de armar y colocar se ejecutaron todas las
combinaciones posibles: solo una produce la salida indicada como meta.

## Dinámica de la actividad

- El estudiante recorre la ciudad con las flechas o las teclas W, A, S y D; en dispositivos móviles, con una palanca
  en pantalla. Al elegir una misión de la lista, el vehículo llega por sí solo.
- Cada misión presenta una situación, un programa y un reto: seguir, calcular, repartir, armar, intercalar o colocar.
- En los retos con programa, una consola integrada lo ejecuta con Go.
- Una respuesta incorrecta muestra una pista; la misión cambia de lugar y se puede volver a intentar.
- Al finalizar las diez misiones se generan un informe de desempeño por tema y un certificado de finalización con
  el nombre del estudiante.

## Evidencia para el docente

El estudiante entrega en Canvas el certificado en formato PNG. El certificado registra las misiones resueltas al
primer intento, el desempeño por tema, la fecha y un código de verificación.

## Privacidad y seguridad

- La aplicación solo solicita nombre y apellido. El progreso se almacena en el navegador del propio dispositivo
  (`localStorage`) y no se envía a ningún servidor.
- Al ejecutar un programa, únicamente su código se envía al servicio público Go Playground (go.dev) para compilarlo
  y ejecutarlo. Sin conexión, la consola muestra la salida registrada al preparar el juego.
- Las respuestas correctas no se publican en el código: se conserva su huella SHA-256, y las explicaciones se
  almacenan cifradas con AES-GCM mediante la API Web Crypto del navegador.
- La página aplica una política de seguridad de contenido (CSP) restrictiva y no envía información de referencia
  (`referrer`) a sitios externos.

## Requisitos técnicos

Navegador web actualizado (Chrome, Edge, Firefox o Safari), en computador o dispositivo móvil, con JavaScript
habilitado y conexión a internet para la consola de Go. No requiere instalación ni registro.

## Ejecución local

Se trata de un sitio estático sin dependencias. Desde la carpeta del repositorio:

```
python -m http.server 8000
```

Luego se abre `http://localhost:8000` en el navegador.

## Estructura del repositorio

| Archivo | Contenido |
|---|---|
| `index.html` | Página principal |
| `app.js` | Misiones, consola, informe y certificado |
| `ciudad.js` | Ciudad, vehículo, tráfico y minimapa |
| `datos.js` | Misiones con respuestas protegidas |
| `cifra.js` | Verificación de respuestas y descifrado de explicaciones |
| `arte.js` | Ilustraciones vectoriales |
| `ciudad.css` | Estilos de la interfaz |

## Referencias

- Arizona State University. (2023). *IFT 365: Applied Programming Languages*. Unit 13: Goroutines and channels.
- McGavren, J. (2020). *Head First Go*. O'Reilly Media.
- The Go Authors. (s. f.). *Package sync* y *Package net/http*. https://pkg.go.dev
