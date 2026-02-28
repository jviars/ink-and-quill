interface TauriWindow {
  __TAURI__: {
    invoke(cmd: string, args?: any): Promise<any>
    dialog: {
      open(options: {
        directory?: boolean
        multiple?: boolean
        defaultPath?: string
        filters?: Array<{
          name: string
          extensions: string[]
        }>
      }): Promise<string | string[] | null>
      save(options?: {
        defaultPath?: string
        filters?: Array<{
          name: string
          extensions: string[]
        }>
      }): Promise<string | null>
    }
    fs: {
      readTextFile(path: string): Promise<string>
      readBinaryFile(path: string): Promise<Uint8Array>
      writeTextFile(path: string, contents: string): Promise<void>
      writeBinaryFile(path: string, contents: Uint8Array): Promise<void>
      exists(path: string): Promise<boolean>
      createDir(path: string, options?: { recursive?: boolean }): Promise<void>
      removeDir(path: string, options?: { recursive?: boolean }): Promise<void>
      removeFile(path: string): Promise<void>
    }
    path: {
      join(...paths: string[]): Promise<string>
      appDir(): Promise<string>
      homeDir(): Promise<string>
      documentDir(): Promise<string>
    }
  }
}

declare interface Window extends TauriWindow {}
