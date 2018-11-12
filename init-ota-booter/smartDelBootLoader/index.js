const diffDel = require('../../client/base/lib/diffDel')
const S = require('../../client/base/lib/SCompat')

const newBLFL = process.env.NEW_BOOTLOADER_FILE_LIST
const hshs = S.readJSON('mnf_hsh') || []


diffDel({
  S, 
  kMods: newBLFL,
  keep: hshs, 
  rm: [process.env.BL_FILE_LIST_KEY_NAME]
})