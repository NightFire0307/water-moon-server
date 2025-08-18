import { resolve } from 'path'
import { Piscina } from "piscina";

export const piscina = new Piscina({
  filename: resolve(__dirname, './compress-worker.js'),
  maxThreads: 4,
  minThreads: 2,
})