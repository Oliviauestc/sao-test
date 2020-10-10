'use strict'
const path = require('path')
const downloadRepo = require('download-git-repo')
const config = require('./config')

exports.repo = function (repo, folderName) {
  return new Promise((resolve, reject) => {
    const dest = path.join(config.reposDir, folderName)
    downloadRepo(repo, dest, err => {
      if (err) return reject(err)
      resolve(dest)
    })
  })
}
