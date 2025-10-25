import { resolve } from 'path'
import { Piscina } from "piscina";
import os from 'os'

export const piscina = new Piscina({
  filename: resolve(__dirname, './worker.js'),
  maxThreads: os.cpus().length,
  minThreads: 2,
})