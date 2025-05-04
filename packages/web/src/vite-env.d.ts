/// <reference types="vite/client" />

// Add type definition for WGSL raw imports
declare module '*.wgsl?raw' {
    const content: string;
    export default content;
} 