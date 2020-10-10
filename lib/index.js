'use strict'
const path = require('path')
const co = require('co')
const utils = require('./utils')
const download = require('./download')
const config = require('./config')
const event = require('./event')
const generate = require('./generate')

module.exports = co.wrap(function * ({
  template,
  targetFolder = './',
  config: configFileName = 'sao.js',
  install
} = {}) {
  // initialize config folder
  config.ensureConfigDir()

  let dest
  if (utils.isLocalPath(template)) { // 模板在本地
    dest = path.resolve(process.cwd(), template)
  } else if (utils.isRepo(template)) { // 模板在git仓库
    const folderName = template.replace('/', '-').replace(/#[\s\S]*$/, '')
    dest = path.join(config.reposDir, folderName)
    if (install) {
      event.emit('download:start')
      yield download.repo(template, folderName)
      event.emit('download:stop')
    }
    yield utils.checkIfRepoExists(dest, template)
  } else { // 模板在npm库
    const packageName = `template-${template}`
    if (install) {
      event.emit('install-template:start', packageName)
      require('yarn-install')([packageName], {global: true})
    }
    dest = utils.getGlobalPackage(packageName)
    yield utils.checkIfPackageExists(dest, template)
  }

  return yield generate({
    fromPath: dest,
    configFileName,
    targetFolder,
    template
  })
})
