const {
  sendRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  unfriend,
  blockUser,
  unblockUser,
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  getFriendshipStatus,
  getFriendStats,
} = require('./friend.service');

const sendRequestHandler = async (req, res, next) => {
  try {
    const result = await sendRequest(req.user._id, req.params.userId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const acceptRequestHandler = async (req, res, next) => {
  try {
    const result = await acceptRequest(req.user._id, req.params.requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const rejectRequestHandler = async (req, res, next) => {
  try {
    const result = await rejectRequest(req.user._id, req.params.requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const cancelRequestHandler = async (req, res, next) => {
  try {
    const result = await cancelRequest(req.user._id, req.params.requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const unfriendHandler = async (req, res, next) => {
  try {
    const result = await unfriend(req.user._id, req.params.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const blockUserHandler = async (req, res, next) => {
  try {
    const result = await blockUser(req.user._id, req.params.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const unblockUserHandler = async (req, res, next) => {
  try {
    const result = await unblockUser(req.user._id, req.params.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getFriendsHandler = async (req, res, next) => {
  try {
    const result = await getFriends(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getIncomingRequestsHandler = async (req, res, next) => {
  try {
    const result = await getIncomingRequests(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getOutgoingRequestsHandler = async (req, res, next) => {
  try {
    const result = await getOutgoingRequests(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getFriendshipStatusHandler = async (req, res, next) => {
  try {
    const result = await getFriendshipStatus(req.user._id, req.params.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getFriendStatsHandler = async (req, res, next) => {
  try {
    const result = await getFriendStats(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendRequestHandler,
  acceptRequestHandler,
  rejectRequestHandler,
  cancelRequestHandler,
  unfriendHandler,
  blockUserHandler,
  unblockUserHandler,
  getFriendsHandler,
  getIncomingRequestsHandler,
  getOutgoingRequestsHandler,
  getFriendshipStatusHandler,
  getFriendStatsHandler,
};
