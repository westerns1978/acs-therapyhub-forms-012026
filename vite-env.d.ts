/// <reference types="vite/client" />

// Allow importing the user-guide markdown files as raw strings, e.g.
//   import welcome from '../../docs/user-guide/00-welcome.md?raw';
declare module '*.md?raw' {
  const content: string;
  export default content;
}
