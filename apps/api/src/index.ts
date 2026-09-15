import * as dotenv from 'dotenv'
dotenv.config()

import { AppDataSource } from '@ford-intel/database'
import { buildApp } from './app'

const start = async () => {
  try {
    await AppDataSource.initialize()
    console.log('Banco de dados conectado!')

    const app = await buildApp()

    const port = parseInt(process.env.PORT || '3333')
    await app.listen({ port, host: '0.0.0.0' })
    console.log(`API rodando em http://localhost:${port}`)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

start()
