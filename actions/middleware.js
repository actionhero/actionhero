exports.middleware = {
    name: 'middleware',
    description: 'I am an example of using middleware defined on a per-action basis.',
    middleware: {
        preprocess: {
            'jwtSession': {},
            'quotaManager': {}
        },
        postprocess: {
            'requestAuditor': {}
        }
    },
    run: function(api, connection, next) {
        connection.response.status = 'OK';
        next(connection, true);
    }
};
