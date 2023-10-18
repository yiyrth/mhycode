import lodash from 'lodash'
import express from 'express'
import { resolve } from 'node:path'
import fs from 'node:fs'
import template from 'express-art-template'
import YAML from 'yaml'

class example {
  constructor () {
    this.cfg = YAML.parse(fs.readFileSync('./config.yaml', 'utf8'))
    this.tmp = {}
    this.isRegister = {}
    this.result = {}
    this.load(express())
    console.log(`Successfully started, port: \x1b[32m${this.cfg.Port}\x1b[0m`)
    console.log('\x1b[32m%s\x1b[0m', `[POST] ${this.address}/register${this.cfg.Key && `?key=${this.cfg.Key}`}`)//`
  }

  load (app) {
    app.listen(this.cfg.Port)
    app.use(express.static(resolve('public')))
    app.use(express.urlencoded({ extended: false }))
    app.use(express.json())
    app.engine('html', template)
    app.set('views', resolve('public'))
    app.set('view engine', 'html')
    app.get('/GTest/:key', this.self('index'))
    app.post('/GTest/register', this.self('register'))
    app.get('/GTest/register/:key', this.self('get_register'))
    app.post('/GTest/validate/:key', this.self('validate'))
    app.get('/GTest/validate/:key', this.self('get_validate'))
    app.use(this.invalid)
    app.use(this.error)
  }

  /** 渲染引擎为常用的art-template */
  index (req, res, next) {
    let { key } = req.params
    if (!key || !this.isRegister[key]) return next('error')
    res.render('GTest/main', { key, copyright: this.cfg.Copyright })
  }

  /** 验证信息, post传mys接口res.data */
  register (req, res, next) {
    let { key } = req.query, { gt, challenge } = req.body || {}
    if (!gt || !challenge) return next('error')
    if (this.cfg.Key && key !== this.cfg.Key) return next('please enter the correct key')
    for (let i = 0; i < 99; i++) {
      key = lodash.sampleSize('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 6).join('')
      if (this.isRegister[key] || this.result[key]) continue
      break
    }
    this.tmp[key] = req.body
    this.isRegister[key] = 1
    /** 未点击2分钟后删除 */
    setTimeout(() => delete this.tmp[key] && delete this.isRegister[key], 120000)
    this.send(res, {
      link: `${this.address}/${key}`,
      result: `${this.address}/validate/${key}`
    })
  }

  /** 浏览器获取gt参数 */
  get_register (req, res, next) {
    let { key } = req.params
    if (!key || !this.tmp[key]) return next('该验证信息已被使用，若非本人操作请重新获取')
    res.send(this.tmp[key] || {})
    delete this.tmp[key]
  }

  /** 浏览器返回validate */
  validate (req, res, next) {
    let { key } = req.params
    if (!key || !req.body) return next('error')
    this.result[key] = req.body
    setTimeout(() => delete this.result[key], 30000)
    this.send(res, {})
    delete this.isRegister[key]
    console.log('[GeeTest] 验证成功, key:', key)
  }

  /** 获取验证结果validate，改为挂起 */
  async get_validate (req, res, next) {
    let { key } = req.params, data = null
    if (!key) return next('error')

    if (this.isRegister[key] || this.result[key]) {
      for (let i = 0; i < 120; i++) {
        if (this.result[key]) {
          data = this.result[key]
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      if (!data) data = {}
    }
    this.send(res, data)
  }

  invalid (req, res) {
    if (!res.finished) res.status(404).end()
  }

  error (err, req, res, next) {
    let message = err?.message || (err !== 'error' && `${err}`) || 'Invalid request'
    if (!res.finished) res.send({ status: 1, message })
  }

  send (res, data, message = 'OK') {
    res.send({
      status: Number(!data),
      message,
      data
    })
  }

  get address () {
    let { Host, Port, Key } = this.cfg
    if (Port !== 80) Host += `:${Port}`
    return `http://${Host}/GTest`
  }

  self (fn) {
    return (...args) => this[fn].call(this, ...args)
  }
}

process.on('unhandledRejection', (error, promise) => console.log(error))
new example()