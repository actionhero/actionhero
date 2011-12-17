function defineModel(api)
{
	var model = api.dbObj.define('Session', {
		key: { type: api.SequelizeBase.STRING, allowNull: false, defaultValue: null, unique: true, autoIncrement: false},
		userID: { type: api.SequelizeBase.INTEGER, allowNull: false, defaultValue: null, unique: true, autoIncrement: false},
		data: { type: api.SequelizeBase.STRING, allowNull: false, defaultValue: null, unique: false, autoIncrement: false},
	});	
	return model;
}

function defineSeeds(api){
	return null;
}

exports.defineModel = defineModel;
exports.defineSeeds = defineSeeds;