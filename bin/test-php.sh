#!/usr/bin/env bash
#
# Runs the PHPUnit suite inside the development site's own PHP container.
#
# The alternative is wp-env, which works and which `npm run test:php` still
# uses — but it means a second WordPress, a second MySQL and a second PHP on the
# machine purely to run tests against a plugin that is already installed in the
# first one. This borrows the site's containers instead: it has a
# wordpress-develop checkout, so it has the Core test library at
# `tests/phpunit/`, a `wp-tests-config.php` pointing at `wordpress_develop_tests`,
# and a PHP container with the right extensions already built.
#
# The plugin is copied in rather than mounted, so nothing the suite does — and it
# does drop tables — can touch the working tree or the running site's plugin.
#
# Usage:
#   bin/test-php.sh                     # the whole suite
#   bin/test-php.sh --group templates   # anything else goes straight to PHPUnit
#
set -euo pipefail

ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
SITE="${ATCF_DEV_SITE:-$( cd "$ROOT/../wordpress-alcazaba" 2>/dev/null && pwd || true )}"
DEST=/tmp/atcf-tests

if [ -z "$SITE" ] || [ ! -f "$SITE/wp-tests-config.php" ]; then
	echo "No development site found. Set ATCF_DEV_SITE to a wordpress-develop checkout," >&2
	echo "or run the suite through wp-env with \`npm run test:php\`." >&2
	exit 1
fi

if ! ( cd "$SITE" && docker compose ps --services --filter status=running 2>/dev/null | grep -qx php ); then
	echo "The development site's PHP container is not running." >&2
	echo "Start it with \`cd $SITE && docker compose up -d\`." >&2
	exit 1
fi

CID="$( cd "$SITE" && docker compose ps -q php )"

# `docker cp` of a directory that already exists nests it, so the old copy goes
# first. Excluding node_modules matters more than it looks: it is 200MB of files
# PHPUnit will never read, and copying it turns a two-second run into a minute.
docker exec "$CID" rm -rf "$DEST"
docker exec "$CID" mkdir -p "$DEST"

tar --no-xattrs --exclude=node_modules --exclude=.git --exclude=dist -cf - -C "$ROOT" . \
	| docker exec -i "$CID" tar -xf - -C "$DEST"

docker exec \
	-e WP_TESTS_DIR=/var/www/tests/phpunit \
	-e WP_TESTS_CONFIG_FILE_PATH=/var/www/wp-tests-config.php \
	-w "$DEST" \
	"$CID" \
	php vendor/bin/phpunit --configuration tests/phpunit/phpunit.xml.dist "$@"
