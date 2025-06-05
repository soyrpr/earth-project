# Earth Project

Este proyecto es una aplicación web desarrollada con Angular que visualiza datos de la Tierra utilizando Three.js para gráficos 3D.

## Estructura del Proyecto

### Directorios Principales

- `src/`: Contiene el código fuente principal de la aplicación
  - `app/`: Componentes, servicios y módulos de la aplicación
  - `core/`: Servicios y utilidades core de la aplicación
  - `assets/`: Recursos estáticos (imágenes, modelos 3D, etc.)
  - `styles.css`: Estilos globales de la aplicación

### Archivos de Configuración

- `angular.json`: Configuración principal de Angular
- `tsconfig.json`: Configuración de TypeScript
- `package.json`: Dependencias y scripts del proyecto

## Componentes Principales

### Generación de Componentes

Los componentes en este proyecto se generan utilizando el CLI de Angular con el siguiente comando:

```bash
ng generate component [nombre-del-componente]
```

Esto crea:
- Un archivo `.component.ts` con la lógica del componente
- Un archivo `.component.html` con la plantilla
- Un archivo `.component.css` con los estilos
- Un archivo `.component.spec.ts` para pruebas

### Estructura de Componentes

Cada componente sigue la arquitectura de Angular con:
- Decorador `@Component`
- Selector único
- Plantilla HTML
- Estilos CSS/SCSS
- Lógica TypeScript

## Servicios

Los servicios se generan con:

```bash
ng generate service [nombre-del-servicio]
```

Los servicios son singleton que manejan:
- Lógica de negocio
- Comunicación con APIs
- Estado de la aplicación
- Funcionalidades compartidas

## Módulos

Los módulos se generan con:

```bash
ng generate module [nombre-del-modulo]
```

Los módulos organizan:
- Componentes relacionados
- Servicios
- Directivas
- Pipes

## Desarrollo

### Requisitos Previos

- Node.js (versión LTS recomendada)
- npm (incluido con Node.js)
- Angular CLI (`npm install -g @angular/cli`)

### Instalación

1. Clonar el repositorio
2. Instalar dependencias:
```bash
npm install
```

### Comandos de Desarrollo

- `ng serve`: Inicia el servidor de desarrollo
- `ng build`: Compila el proyecto
- `ng test`: Ejecuta las pruebas
- `ng lint`: Ejecuta el linter

## Construcción y Despliegue

### Producción

Para generar una versión de producción:

```bash
ng build --prod
```

Esto crea una versión optimizada en el directorio `dist/`.

### Despliegue

La aplicación puede ser desplegada en cualquier servidor web estático o servicios como:
- GitHub Pages
- Netlify
- Vercel
- Firebase Hosting

## Estructura de Datos

### Modelos

Los modelos de datos se definen como interfaces TypeScript en archivos separados, típicamente en:
- `src/app/models/`

### Servicios de Datos

Los servicios que manejan datos se encuentran en:
- `src/app/services/`

## Estilos y Temas

- Los estilos globales están en `src/styles.css`
- Los componentes tienen sus propios estilos scoped
- Se utilizan variables CSS para temas y colores

## Pruebas

- Pruebas unitarias: `ng test`
- Pruebas e2e: `ng e2e`
- Los archivos de prueba usan el patrón `.spec.ts`

## Convenciones de Código

- Nombres de archivos: kebab-case
- Nombres de clases: PascalCase
- Nombres de métodos y variables: camelCase
- Interfaces: prefijo 'I' (ej: IUserData)
- Enums: PascalCase

## Documentación

La documentación del código se mantiene usando:
- Comentarios JSDoc para funciones y clases
- README.md para documentación general
- Comentarios inline para lógica compleja
