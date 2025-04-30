// Type declaration for multer
declare module 'multer' {
  import { Request } from 'express';
  
  function multer(options?: any): any;
  
  namespace multer {
    function memoryStorage(): any;
    function diskStorage(options: any): any;
    
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer: Buffer;
    }
  }
  
  // Extend the Express Request interface
  namespace Express {
    interface Request {
      file?: multer.File;
      files?: {
        [fieldname: string]: multer.File[];
      } | multer.File[];
    }
  }
  
  export = multer;
}