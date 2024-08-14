import { gzip as gzip_ } from "node:zlib";
import { promisify } from "node:util";

export const gzip = promisify(gzip_);
