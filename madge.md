Usage: madge [options] <src...>

Options:
  -V, --version            output the version number
  -b, --basedir <path>     base directory for resolving paths
  -s, --summary            show dependency count summary
  -c, --circular           show circular dependencies
  -d, --depends <name>     show module dependents
  -x, --exclude <regexp>   exclude modules using RegExp
  -j, --json               output as JSON
  -i, --image <file>       write graph to file as an image
  -l, --layout <name>      layout engine to use for graph
                           (dot/neato/fdp/sfdp/twopi/circo)
  --orphans                show modules that no one is depending on
  --leaves                 show modules that have no dependencies
  --dot                    show graph using the DOT language
  --rankdir <direction>    set the direction of the graph layout
  --extensions <list>      comma separated string of valid file extensions
  --require-config <file>  path to RequireJS config
  --webpack-config <file>  path to webpack config
  --ts-config <file>       path to typescript config
  --include-npm            include shallow NPM modules (default: false)
  --no-color               disable color in output and image
  --no-spinner             disable progress spinner
  --no-count               disable circular dependencies counting
  --stdin                  read predefined tree from STDIN (default: false)
  --warning                show warnings about skipped files (default: false)
  --debug                  turn on debug output (default: false)
  -h, --help               display help for command

