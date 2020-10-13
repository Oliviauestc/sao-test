'use strict'
const path = require('path')
const co = require('co')
const chalk = require('chalk')
const copy = require('kopy')
const $ = require('shelljs')
const config = require('./config')
const promptRole = require('./prompt-role')
const SAOError = require('./sao-error')
const log = require('./log')
const utils = require('./utils')
const fs = require('fs')
const { execSync } = require('child_process');

module.exports = co.wrap(function * ({
  fromPath,
  configFileName,
  targetFolder,
  template
} = {}) {
  const projectConfig = yield config.getConfig(fromPath, configFileName, template)

  let skipInterpolation
  let prompts
  let filters
  let postAction
  let move
  let enforceType
  let templateEngine
  let templateOptions
  let templateFolder = './'

  if (projectConfig) {
    templateFolder = 'template'
    // skip rendering some files
    skipInterpolation = projectConfig.skipInterpolation
    // file filters
    filters = projectConfig.filters
    postAction = projectConfig.post
    // move files
    move = projectConfig.move
    if (projectConfig.enforceNewFolder) {
      enforceType = 'new'
    } else if (projectConfig.enforceCurrentFolder) {
      enforceType = 'current'
    }
    try{
      fs.statSync(path.join(fromPath, 'node_modules'));
      //如果可以执行到这里那么就表示模板中node_modules存在
    }catch(e){
      //node_modules不存在
      execSync(`npm install`, {cwd: fromPath})
    }
    // get template engine
    templateEngine = typeof projectConfig.template === 'string' ?
      utils.requireAt(fromPath, `jstransformer-${projectConfig.template}`) :
      projectConfig.template
    templateOptions = projectConfig.templateOptions

    // get data from prompts
    if (projectConfig.prompts) {
      if (Array.isArray(projectConfig.prompts)) {
        prompts = projectConfig.prompts
      } else {
        prompts = Object
          .keys(projectConfig.prompts)
          .map(name => Object.assign({
            name
          }, projectConfig.prompts[name]))
      }
      prompts = prompts.map(promptRole({targetFolder}))
    }
  }

  const folderPath = path.resolve(process.cwd(), targetFolder)
  const folderName = path.basename(folderPath)
  const templateContext = {
    folderName,
    folderPath,
    isNewFolder: targetFolder !== './'
  }
  if (templateContext.isNewFolder) {
    if (enforceType === 'current') {
      let msg = `template \`${template}\` requires you to initialize it in current working directory!\n`
      msg += `\n${chalk.dim(`> tip: You can try \`sao ${template}\` instead.`)}`
      throw new SAOError(msg)
    }
  } else if (enforceType === 'new') {
    let msg = `template \`${template}\` requires you to initialize it in a new folder!\n`
    msg += `\n${chalk.dim(`> tip: You can try \`sao ${template} <folder-name>\` instead.`)}`
    throw new SAOError(msg)
  }

  return yield copy(path.join(fromPath, templateFolder), targetFolder, {
    template: templateEngine,
    templateOptions,
    skipInterpolation,
    prompts,
    data: {_: templateContext},
    filters,
    clean: false
  }).then(({files, data}) => {
    if (move) {
      for (const from in move) {
        $.mv(from, move[from])
      }
    }
    delete data._
    const actionContext = Object.assign({
      files,
      data,
      $,
      chalk,
      log,
      install: () => {
        require('yarn-install')({cwd: folderPath})
      },
      init: () => {
        $.exec('git init', {cwd: folderPath})
      }
    }, templateContext)
    const action = postAction && postAction(actionContext)
    if (action && action.then) return action.then(() => files)
    return files
  })
})
