import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';
import { helpers as rules } from 'playing-rule-services';

export const fulfillActivityRequires = (activity, user) => {
  return rules.fulfillRequires(user, [], activity.requires);
};

export const fulfillActivityRewards = (activity, user) => {
  return rules.fulfillCustomRewards(fp.pick(['requires', 'rewards'], activity), [], user);
};

/**
 * get available task of an activity at a given keys, based by previous task state
 */
const getReadyTask = (user, tasks, keys, activity, previous) => {
  const key = keys.join('.');
  const task = fp.find(fp.propEq('key', key), tasks);
  const rewards = fp.map(reward => {
    const metric = fp.pickPath(['metric', 'metric.id', 'metric.name', 'metric.type'], reward);
    return fp.assoc('metric', metric.metric, reward);
  }, activity.rewards || []);

  if (!previous || previous.state === 'COMPLETED') {
    if (task && task.name == activity.name) { // check name with key
      if (task.state !== 'COMPLETED') {
        return fp.assoc('rewards', rewards, task);
      }
    } else if (fulfillActivityRequires(activity, user)) {
      return { key, name: activity.name, state: 'READY', rewards: rewards, loop: 0 };
    }
  }
  return null;
};

/**
 * Walk throught activities of mission to get ready activities,
 * and update state of sequential/parallel/exclusive node.
 */
export const walkThroughTasksReady = (user, tasks = [], keys = [], previous = null, keepPrevious = false) => (activities) => {
  return fp.reduceIndexed((acc, activity, index) => {
    const task = getReadyTask(user, tasks, [...keys, index], activity, previous);
    if (!task) return acc; // break

    const subActivities = activity.activities || [];
    switch (activity.type) {
      case 'single': {
        acc = acc.concat([task]);
        previous = keepPrevious? previous : task;
        break;
      }
      case 'sequential': {
        const subTasks = walkThroughTasksReady(user, tasks, [...keys, index], previous)(subActivities);
        const completed = fp.filter(fp.propEq('state', 'COMPLETED'), subTasks);
        if (completed.length == subActivities.length) { // all completed
          task.state = 'COMPLETED';
        } else {
          task.state = completed.length? 'ACTIVE' : 'READY';
        }
        acc = acc.concat(subTasks);
        previous = task;
        break;
      }
      case 'parallel': {
        const subTasks = walkThroughTasksReady(user, tasks, [...keys, index], previous, true)(subActivities);
        const completed = fp.filter(fp.propEq('state', 'COMPLETED'), subTasks);
        if (completed.length == subActivities.length) { // all completed
          task.state = 'COMPLETED';
        } else {
          task.state = 'READY';
        }
        acc = acc.concat(subTasks);
        previous = task;
        break;
      }
      case 'exclusive': {
        const subTasks = walkThroughTasksReady(user, tasks, [...keys, index], previous, true)(subActivities);
        const completed = fp.filter(fp.propEq('state', 'COMPLETED'), subTasks);
        if (completed.length > 0) { // any completed
          task.state = 'COMPLETED';
          acc = acc.concat(completed);
        } else {
          task.state = 'READY';
          acc = acc.concat(subTasks);
        }
        previous = task;
        break;
      }
    }
    return acc;
  }, [], activities);
};

export const getRecursiveRequires = (path) => (activities) => {
  return fp.reduce((arr, activity) => {
    if (activity.type === 'single') {
      arr.push(fp.dotPath(path, activity) || []);
    } else {
      arr.push(fp.flatten(getRecursiveRequires(path)(activity.activities || [])));
    }
    return arr;
  }, [], activities);
};

export const getRecursiveRewards = (path) => (activities) => {
  return fp.reduce((arr, activity) => {
    if (activity.type === 'single') {
      return arr.concat(fp.dotPath(path, activity) || []);
    } else {
      return arr.concat(fp.flatten(getRecursiveRewards(path)(activity.activities || [])));
    }
  }, [], activities);
};

// default mission lanes
export const defaultLane = (service, id) => async (params) => {
  const mission = await service.get(params[id]);
  if (mission && mission.lanes) {
    const lane = fp.find(fp.propEq('default', true), mission.lanes);
    return lane? lane.name : null;
  }
  return null;
};

// validator for roles
export const rolesExists = (service, id, message) => async (val, params) => {
  const userMission = await service.get(params[id], { query: { $select: 'mission,*' } });
  const lanes = fp.keys(val), roles = fp.values(val);
  if (userMission && userMission.mission && userMission.mission.lanes) {
    if (fp.includesAll(lanes, fp.map(fp.prop('name'), userMission.mission.lanes))
      && fp.includesAll(roles, ['player', 'observer'])) return;
  } else {
    message = 'User mission is not exists';
  }
  return message;
};

// default roles
export const defaultRoles = (service, id) => async (params) => {
  const userMission = await service.get(params[id], { query: { $select: 'mission,*' } });
  if (userMission && userMission.mission && userMission.mission.lanes) {
    const lane = fp.find(fp.propEq('default', true), userMission.mission.lanes);
    return lane? { [lane.name] : 'player' } : null;
  }
  return null;
};

// create a user mission activity
export const createMissionActivity = (context, userMission, custom) => {
  const actor = helpers.getId(userMission.owner);
  const mission = helpers.getId(userMission.mission);
  return {
    actor: `user:${actor}`,
    object: `userMission:${userMission.id}`,
    foreignId: `userMission:${userMission.id}`,
    time: new Date().toISOString(),
    mission: `mission:${mission}`,
    ...custom
  };
};

// notification feeds of all performers
export const performersNotifications = function (performers, excepts = []) {
  const users = fp.without(excepts, fp.map(fp.prop('user'), performers || []));
  return fp.map(fp.concat('notification:'), users);
};

export const getPendingActivity = async (app, primary, id) => {
  const svcFeedsActivities = app.service('feeds/activities');
  return await svcFeedsActivities.get(id, { primary, query: { state: 'PENDING' } });
};

export const updateActivityState = async (app, activity) => {
  const svcFeedsActivities = app.service('feeds/activities');
  const feeds = fp.reject(fp.isNil, [activity.feed].concat(activity.source || activity.cc));
  // update activity in all feeds by foreignId/time
  const updateAll = fp.map(feed => {
    return svcFeedsActivities.patch(null, {
      state: activity.state
    }, {
      primary: feed,
      query: { foreignId: activity.foreignId, time: activity.time }
    });
  });
  return Promise.all(updateAll(feeds));
};

export const addUserMissionRoles = async (app, userMission, user, lanes) => {
  const svcUserMissions = app.service('user-missions');
  await svcUserMissions.patch(userMission.id, {
    $addToSet: {
      performers: { user, lanes }
    }
  });
};

export const updateUserMissionRoles = async (app, userMission, user, lanes, params = {}) => {
  const svcUserMissions = app.service('user-missions');
  params.query = fp.assignAll(params.query, {
    'performers.user': user
  });
  const updates = fp.reduce((acc, lane) => {
    if (lanes[lane] !== 'false') {
      acc[`performers.$.lanes.${lane}`] = lanes[lane];
    } else {
      acc['$unset'] = acc['$unset'] || [];
      acc['$unset'].push({ [`performers.$.lanes.${lane}`]: '' });
    }
    return acc;
  }, {}, fp.keys(lanes));
  return svcUserMissions.patch(userMission.id, updates, params);
};