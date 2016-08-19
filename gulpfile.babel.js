/*
 * Gulp tasks for development and deployment.
 *
 * The "dev" task compiles files unminified with sourcemaps and watches the source files for changes.
 *
 * The "production" task compiles and minifies source files.
 * It also modifies package.json for publishing to npm.
 */

import _ from 'lodash';
import async from 'async';

import gulp from 'gulp';
import babel from 'gulp-babel';
import sourcemaps from 'gulp-sourcemaps';
import uglify from 'gulp-uglify';
import plumber from 'gulp-plumber';

import del from 'del';
import gutil from 'gulp-util';
import runSequence from 'run-sequence';
import chalk from 'chalk';

import cache from 'gulp-cached';

import path from 'path';
import fs from 'fs';

import pjson from './package.json';

// Convenience function for 'copies' config options
// Takes src & dest paths and turns them into an object
const paths = (src, dest) => ({ src, dest });

export const config = {
    src: [ 'src/**/*.js' ],
    
    // For debugging compiled code
    srcRoot: path.join(__dirname, 'src'),

    // Any additional files that should be copied over to dist/
    // Format:
    // {
    //      src: String, // relative path to the file from the project root
    //      dest: String, // destination path for the file, relative to dist/
    // }
    copies: [
        paths(
            'package.json',
            '/'
        ),

        paths(
            'README.md',
            '/'
        ),

        paths(
            'LICENSE',
            '/'
        )
    ],

    optsBabel: {
        presets: [ 'es2015', 'stage-0' ]
    },
};

// Print nice, colorful errors
function mapError (err) {
    console.dir(err);
    console.log(err.stack);
    if (err.fileName) {
        // regular error
        return gutil.log(chalk.red(err.name)
            + ': '
            + chalk.yellow(err.fileName.replace(__dirname + '/src', ''))
            + ': '
            + 'Line '
            + chalk.magenta(err.lineNumber)
            + ' & '
            + 'Column '
            + chalk.magenta(err.columnNumber || err.column)
            + ': '
            + chalk.blue(err.description));
    } else {
        // browserify error
        gutil.log(chalk.red(err.name)
            + ': '
            + chalk.yellow(err.message));
    }
};

// Log file watcher updates to console
function mapUpdate (evt) {
    let type = evt.type || 'updated';

    // For non-browserify events, the changed paths are in evt.path
    // For browserify events, evt is the changed paths
    // evt.path & path can either be a single path or an array of paths.
    let paths = _.flatten([ (evt.path || evt) ]);

    _.each(paths, (path) => {
        let shortenedPath = path.split('src').reduce((prev, current) => current);
        gutil.log(
            'File ' +
            chalk.green(shortenedPath) +
            ' was ' +
            chalk.blue(type) +
            '. Rebuilding...'
        );
    })
};

// Clean the dist directory
export const clean = () => del([ 'dist/**', ]);
gulp.task('clean', clean);

// Convert es6 to es5 for a dev build
export const babelDev = (done = _.noop) => gulp
    .src(config.src)
    .pipe(plumber(mapError))
    .pipe(cache('babel'))
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(sourcemaps.write('.', { sourceRoot: config.srcRoot }))
    .pipe(gulp.dest('dist/'))
    .on('end', done);

gulp.task('babel:dev', done => {
    babelDev(done);
});

// Convert es6 to es5 for a production build
export const babelProd = (done = _.noop) => gulp
    .src(config.src)
    .pipe(plumber(mapError))
    .pipe(cache('babel'))
    .pipe(babel())
    .pipe(uglify())
    .pipe(gulp.dest('dist/'))
    .on('end', done);

gulp.task('babel:production', done => {
    babelProd(done);
});

// To cache the files for use by the watch task,
// the cache argument will be used as the key
// for the cache.
export function copyFiles (src, dest, cacheKey = '') {
    if (cacheKey) {
        return gulp
            .src(src)
            .pipe(cache(cacheKey))
            .pipe(gulp.dest(dest));
    } else {
        return gulp
            .src(src)
            .pipe(gulp.dest(dest));
    }
}

// Copy all misc files over to dist
// See config.copies for a list of these files
gulp.task('copies', done => {
    async.each(
        config.copies,
        ({ src, dest }, cb) => {
            copyFiles(src, `dist/${dest}`, src + dest)
                .on('end', cb);
        },
        done
    );
});

gulp.task('watch', () => {
    // Returns a stream that watches src for changes and runs task.
    // If isCached is true, removes deleted files from the cache
    // for that task.
    function watch ({ src, opts = {} }, task, isCached) {
        let watcher = gulp.watch(src, opts, [ task ]);
        watcher.on('change', mapUpdate);

        if (isCached) {
            watcher.on('change', (evt) => {
                // Remove delete scripts from the cache
                if (evt.type === 'deleted') {
                    delete cache.caches[task][evt.path];
                }
            });
        }
        return watcher;
    };

    // Watch source files. No need to return
    const watchBabel = watch({ src: config.src }, 'babel:dev');

    // Watch everything in 'copies'
    // Don't need to return this either
    const copies = _.map(
        config.copies,
        ({ src }) => watch({ src }, 'copies')
    );
});

// Prepare the already-built dist directory for publishing to npm.
gulp.task('pack', done => {
    // Remove dev stuff from package.json
    const npmPackage = _.omit(
        pjson,
        [ 'devDependencies', 'scripts' ]
    );

    // Update package.json in the dist/ directory
    fs.writeFile('dist/package.json', JSON.stringify(npmPackage, null, '  '), 'utf-8', done);
});

gulp.task('dev', (done) => {
    runSequence(
        'clean',
        [ 'copies', 'babel:dev' ],
        'watch',
        done
    );
});

gulp.task('production', done => {
    runSequence(
        'clean',
        [ 'copies', 'babel:production' ],
        'pack',
        done
    );
});

gulp.task('default', [ 'production' ]);
