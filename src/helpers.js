import fp from 'mostly-func';
import { helpers as rules } from 'playing-rule-services';

export const fulfillActivityRequires = (activity, user) => {
  return rules.fulfillRequires(user, [], activity.requires);
};

export const fulfillActivityRewards = (activity, user) => {
  return rules.fulfillCustomRewards(fp.pick(['requires', 'rewards'], activity), [], user);
};

// get a task of an activity at a given keys,
// based by previous task state
const getTask = (user, tasks, keys, activity, previous) => {
  const key = keys.join('.');
  const task = fp.find(fp.propEq('key', key), tasks);
  const rewards = fp.map(fp.pickPath([
    'verb', 'value', 'item', 'metric.id', 'metric.name', 'metric.type'
  ]), activity.rewards || []);

  if (!previous || previous.state === 'COMPLETED') {
    if (task && task.name == activity.name) { // check name with key
      return fp.assoc('rewards', rewards, task);
    } else if (fulfillActivityRequires(activity, user)) {
      return { key, name: activity.name, state: 'READY', rewards: rewards, loop: 0 };
    }
  }
  return null;
};

export const walkThroughTasks = (user, tasks = [], keys = [], previous = null, keepPrevious = false) => (activities) => {
  return fp.reduceIndexed((acc, activity, index) => {
    const task = getTask(user, tasks, [...keys,index], activity, previous);
    if (!task) return acc; // break

    const subActivities = activity.activities || [];
    switch (activity.type) {
      case 'single': {
        acc = acc.concat([task]);
        previous = keepPrevious? previous : task;
        break;
      }
      case 'sequential': {
        const subTasks = walkThroughTasks(user, tasks, [...keys,index], previous)(subActivities);
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
        const subTasks = walkThroughTasks(user, tasks, [...keys,index], previous, true)(subActivities);
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
        const subTasks = walkThroughTasks(user, tasks, [...keys,index], previous, true)(subActivities);
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

// notification feeds of all performers
export const performersNotifications = function (performers, excepts = []) {
  const users = fp.without(
    fp.map(fp.toString, [].concat(excepts)),
    fp.map(fp.pipe(fp.prop('user'), fp.toString), performers || [])
  );
  return fp.map(fp.concat('notification:'), users);
};