/*
 * Publish the package to npm.
 */

const R = require('ramda')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const execSync = require('child_process').execSync
const noop = () => {}

const rollup = require('rollup')
const commonjs = require('rollup-plugin-commonjs')
const nodeResolve = require('rollup-plugin-node-resolve')

// Prints a message to the console with a timestamp prefixed.
const formatTime = R.pipe(
  R.constructN(0, Date),
  R.juxt([ R.invoker(0, 'getHours'), R.invoker(0, 'getMinutes'), R.invoker(0, 'getSeconds' )]),
  R.invoker(1, 'join')(':')
)
const log = (...messages) => console.log.call(console, chalk.blue(`[${formatTime()}]`), ...messages)
const logColor = R.converge(R.pipe)([
  R.unary(R.pipe(R.map, R.unapply)),
  R.always(R.apply(log))])
log.info = logColor(chalk.green)
log.warn = logColor(chalk.yellow)
log.error = logColor(chalk.red)

// Run a series of functions. Just like a pipe() called with 0 arguments.
const all = R.pipe(
  R.unapply(R.call(R.apply(R.pipe), R.__)),
  R.call
)

// Synchronously remove a directory and all children.
// This function has a much simpler imperative implementation
const isDirectory = R.pipe(R.unary(fs.lstatSync), R.invoker(0, 'isDirectory'))
function remove (path) {
  return R.ifElse(isDirectory)
  (R.converge(
    R.call,
    [
      R.converge(R.pipe, [
        R.always(R.unary(fs.readdirSync)),
        R.pipe(
          // A function that appends a filename to the directory path
          R.flip(R.concat)('/'), R.concat,

          // Pass the "append filename" function to an iterator that removes each file in the directory
          R.converge(R.pipe, [ R.identity, R.always(remove) ]), R.forEach
        ),

        // rmdir the arguments to the outer function (the directory path)
        R.pipe(fs.rmdirSync.bind.bind(fs.rmdirSync, null), R.unary)
      ]),

      R.identity
    ]
  ))

  // Just remove non-directory files directly
  (R.unary(fs.unlinkSync))
  (path)
}

// Log an error message and exit with an error code.
const die = R.pipe(log.error, process.exit.bind(process, 1))

// Do a synchronous operation and exit if the operation fails.
const must = R.tryCatch(R.__, die)

// Do a synchronous operation, ignoring any errors.
const attempt = R.tryCatch(R.__, noop)

// Synchronously write a file to disk with utf-8 encoding.
const write = R.curryN(3, fs.writeFileSync)(R.__, R.__, 'utf-8')

const packageJson = require('./package.json')
const isDryRun = R.any(R.anyPass([ R.equals('-n'), R.equals('--dry-run') ]), Array.from(process.argv))
const omitDevelopmentKeys = R.omit([ 'devDependencies', 'scripts' ])

log.info(`Publishing ${chalk.black(`${packageJson.name}@${packageJson.version}`)} to npm...`)
isDryRun && log.warn('Dry run (will not contact npm)')

log(`Creating ${chalk.black('dist/')} directory...`)
all(
  attempt(remove.bind(null, 'dist')),
  must(R.unary(fs.mkdirSync).bind(fs, 'dist'))
)

log(`Writing bundle for ${chalk.black(packageJson.main)}...`)
createBundle(packageJson.main, path.join('dist', packageJson.main))
  .then(() => {
    log(`Preparing ${chalk.black('package.json')}...`)
    R.pipe(
      omitDevelopmentKeys,
      R.curryN(3, JSON.stringify)(R.__, null, '  '),
      must(write('dist/package.json'))
    )(packageJson)

    log(`Publishing to npm...`)
    isDryRun && log.warn('Dry run: skipped publish...')
    R.ifElse(Boolean)
      (R.unary(log.info).bind(null, 'Finished dry run.'))
      (must(execSync.bind(null, 'npm publish', { cwd: 'dist' })))
      (isDryRun)
  })

  .catch(err => die(`Failed to write bundle: ${err.message}`))

function createBundle (target, destination) {
  return rollup.rollup({
    entry: target,
    plugins: [
      nodeResolve({
        jsnext: true,
      }),
      commonjs({
        sourcemap: false,
      }),
    ]
  }).then(bundle => {
    bundle.write({
      format: 'cjs',
      dest: destination,
    })
  })
}
