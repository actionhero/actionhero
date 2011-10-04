function defineModel(api)
{
	var model = api.dbObj.define('Log', {
		ip: { type: api.SequelizeBase.STRING, allowNull: false, defaultValue: "0.0.0.0", unique: false, autoIncrement: false},
		action: { type: api.SequelizeBase.STRING, allowNull: true, defaultValue: null, unique: false, autoIncrement: false},
		error: { type: api.SequelizeBase.TEXT, allowNull: true, defaultValue: null, unique: false, autoIncrement: false},
		params: { type: api.SequelizeBase.TEXT, allowNull: true, defaultValue: null, unique: false, autoIncrement: false},
	});	
	return model;
}

exports.defineModel = defineModel;