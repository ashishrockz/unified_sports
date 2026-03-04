const svc = require('./sportType.service');

const createHandler = async (req, res, next) => {
  try {
    const st = await svc.createSportType(req.body);
    res.status(201).json(st);
  } catch (err) { next(err); }
};

const getAllHandler = async (req, res, next) => {
  try {
    const { search, isActive, page, limit } = req.query;
    res.json(await svc.getSportTypes({ search, isActive, page, limit }));
  } catch (err) { next(err); }
};

const getBySlugHandler = async (req, res, next) => {
  try {
    res.json(await svc.getSportTypeBySlug(req.params.slug));
  } catch (err) { next(err); }
};

const getByIdHandler = async (req, res, next) => {
  try {
    res.json(await svc.getSportTypeById(req.params.sportTypeId));
  } catch (err) { next(err); }
};

const getDefaultsHandler = async (req, res, next) => {
  try {
    res.json(svc.getDefaultConfig(req.params.sport));
  } catch (err) { next(err); }
};

const updateHandler = async (req, res, next) => {
  try {
    res.json(await svc.updateSportType(req.params.sportTypeId, req.body));
  } catch (err) { next(err); }
};

const deleteHandler = async (req, res, next) => {
  try {
    res.json(await svc.deleteSportType(req.params.sportTypeId));
  } catch (err) { next(err); }
};

module.exports = { createHandler, getAllHandler, getBySlugHandler, getByIdHandler, getDefaultsHandler, updateHandler, deleteHandler };
