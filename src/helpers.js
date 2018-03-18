import fp from 'mostly-func';

// get a task of an activity at a given keys,
// based by previous task status
const getTask = (tasks, keys, activity, previous) => {
  const key = keys.join('.');
  const task = fp.find(fp.propEq('key', key), tasks);

  if (!previous || previous.state === 'completed') {
    if (task && task.name == activity.name) { // check name with key
      return fp.assoc('type', activity.type, task);
    } else {
      return { key, name: activity.name, status: 'ready', type: activity.type };
    }
  }
  return null;
};

export const walkThroughTasks = (tasks, keys, previous = null, keepPrevious = false) => (activities) => {
  return fp.reduceIndexed((acc, activity, index) => {
    const task = getTask(tasks, [...keys,index], activity, previous);
    if (!task) return acc; // break

    const subActivities = activity.activities || [];
    switch (activity.type) {
      case 'single': {
        acc = acc.concat([task]);
        previous = keepPrevious? previous : task;
        break;
      }
      case 'sequential': {
        const subTasks = walkThroughTasks(tasks, [...keys,index], previous)(subActivities);
        const completed = fp.filter(fp.propEq('state', 'completed'), subTasks);
        if (completed.length == subActivities.length) { // all completed
          task.state = 'completed';
        } else {
          task.state = completed.length? 'active' : 'ready';
        }
        acc = acc.concat(subTasks);
        previous = task;
        break;
      }
      case 'parallel': {
        const subTasks = walkThroughTasks(tasks, [...keys,index], previous, true)(subActivities);
        const completed = fp.filter(fp.propEq('state', 'completed'), subTasks);
        if (completed.length == subActivities.length) { // all completed
          task.state = 'completed';
        } else {
          task.state = 'ready';
        }
        acc = acc.concat(subTasks);
        previous = task;
        break;
      }
      case 'exclusive': {
        const subTasks = walkThroughTasks(tasks, [...keys,index], previous, true)(subActivities);
        const completed = fp.filter(fp.propEq('state', 'completed'), subTasks);
        if (completed.length > 0) { // any completed
          task.state = 'completed';
          acc = acc.concat(completed);
        } else {
          task.state = 'ready';
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
