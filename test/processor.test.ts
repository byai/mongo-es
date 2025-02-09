import test from 'ava'
import { ObjectID, Timestamp } from 'mongodb'

import { OpLog, MongoDoc, IR, ESDoc } from '../src/types'
import { Controls, Task } from '../src/config'
import Processor from '../src/processor'

const oplog: OpLog = {
  ts: new Timestamp(14, 1495012567),
  op: 'u',
  ns: 'db0.collection0',
  o2: {
    _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
  },
  o: {
    $set: {
      'field0.field1': 'set nested field',
    },
    $unset: {
      'field0.field2': 1,
    },
  },
}

const task: Task = new Task({
  from: {
    phase: 'scan',
  },
  // @ts-ignore
  extract: {},
  transform: {
    mapping: {
      'field0.field1': 'field1',
      'field0.field2': 'field2',
    },
  },
  // @ts-ignore
  load: {},
})

const task2: Task = new Task({
  from: {
    phase: 'scan',
  },
  // @ts-ignore
  extract: {},
  transform: {
    mapping: {
      'field0.field3': 'field3',
    },
  },
  // @ts-ignore
  load: {},
})

const task3 = new Task({
  from: {
    phase: 'scan',
  },
  // @ts-ignore
  extract: {},
  transform: {
    mapping: doc => ({ field1: doc.field0.field1, field2: doc.field0.field2 }),
  },
  // @ts-ignore
  load: {},
})

const mongoDoc: MongoDoc = {
  _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
  field0: {
    field1: 1,
    field2: 2,
  },
}

const esDoc: ESDoc = {
  _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  field1: 1,
  field2: 2,
}

test('transformer create', t => {
  const processor = new Processor(task, new Controls({}), null as any, null as any)
  t.deepEqual(processor.transformer('upsert', mongoDoc), <IR>{
    action: 'upsert',
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    data: {
      field1: 1,
      field2: 2,
    },
    parent: undefined,
    timestamp: 0,
  })
})

test('transformer update', t => {
  const processor = new Processor(task, new Controls({}), null as any, null as any)
  t.deepEqual(processor.transformer('upsert', mongoDoc), <IR>{
    action: 'upsert',
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    data: {
      field1: 1,
      field2: 2,
    },
    parent: undefined,
    timestamp: 0,
  })
})

test('transformer delete', t => {
  const processor = new Processor(task, new Controls({}), null as any, null as any)
  t.deepEqual(processor.transformer('delete', mongoDoc), <IR>{
    action: 'delete',
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    parent: undefined,
    timestamp: 0,
  })
})

test('transformer create by mapping function', t => {
  const processor = new Processor(task3, new Controls({}), null as any, null as any)
  t.deepEqual(processor.transformer('upsert', mongoDoc), <IR>{
    action: 'upsert',
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    data: {
      field1: 1,
      field2: 2,
    },
    parent: undefined,
    timestamp: 0,
  })
})

test('transformer update by mapping function', t => {
  const processor = new Processor(task3, new Controls({}), null as any, null as any)
  t.deepEqual(processor.transformer('upsert', mongoDoc), <IR>{
    action: 'upsert',
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    data: {
      field1: 1,
      field2: 2,
    },
    parent: undefined,
    timestamp: 0,
  })
})

test('applyUpdateMongoDoc', t => {
  const transform = new Processor(task, new Controls({}), null as any, null as any)
  t.deepEqual(transform.applyUpdateMongoDoc(mongoDoc, oplog.o.$set, oplog.o.$unset), {
    _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
    field0: {
      field1: 'set nested field',
    },
  })
})

test('applyUpdateESDoc', t => {
  const transform = new Processor(task, new Controls({}), null as any, null as any)
  t.deepEqual(transform.applyUpdateESDoc(esDoc, oplog.o.$set, oplog.o.$unset), {
    _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    field1: 'set nested field',
  })
})

test('ignoreUpdate true', t => {
  const processor = new Processor(task2, new Controls({}), null as any, null as any)
  t.is(processor.ignoreUpdate(oplog), true)
})

test('ignoreUpdate false', t => {
  const processor = new Processor(task, new Controls({}), null as any, null as any)
  t.is(processor.ignoreUpdate(oplog), false)
})

test('mergeOplogs insert then update', t => {
  const processor = new Processor(
    {
      transform: {
        mapping: {
          'field0.field1': 'field1',
          'field0.field2': 'field2',
        },
      },
    } as any,
    new Controls({}),
    null as any,
    null as any,
  )
  const oplogs = processor.mergeOplogs([
    {
      ts: new Timestamp(0, 0),
      op: 'i',
      ns: 'example1',
      o: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
        'field0.field1': 0,
      },
    },
    {
      ts: new Timestamp(0, 1),
      op: 'u',
      ns: 'example1',
      o: {
        $set: {
          'field0.field1': 1,
        },
        $unset: {
          'field0.field2': 1,
        },
      },
      o2: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
      },
    },
  ])
  t.deepEqual(oplogs, [
    {
      ts: new Timestamp(0, 1),
      op: 'i',
      ns: 'example1',
      o: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
        'field0.field1': 1,
      },
    },
  ])
})

test('mergeOplogs update then update', t => {
  const processor = new Processor(
    {
      transform: {
        mapping: {
          'field0.field1': 'field1',
          'field0.field2': 'field2',
        },
      },
    } as any,
    new Controls({}),
    null as any,
    null as any,
  )
  const oplogs = processor.mergeOplogs([
    {
      ts: new Timestamp(0, 1),
      op: 'u',
      ns: 'example1',
      o: {
        'field0.field1': 1,
        $set: {
          'field0.field2': 1,
        },
      },
      o2: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
      },
    },
    {
      ts: new Timestamp(0, 0),
      op: 'u',
      ns: 'example1',
      o: {
        $set: {
          'field0.field1': 3,
          'field0.field2': 2,
        },
      },
      o2: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
      },
    },
  ])
  t.deepEqual(oplogs, [
    {
      ts: new Timestamp(0, 1),
      op: 'u',
      ns: 'example1',
      o: {
        'field0.field1': 1,
        $set: {
          'field0.field1': 3,
          'field0.field2': 1,
        },
      },
      o2: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
      },
    },
  ])
})

test('mergeOplogs update then delete', t => {
  const processor = new Processor(
    {
      transform: {
        mapping: {
          'field0.field1': 'field1',
          'field0.field2': 'field2',
        },
      },
    } as any,
    new Controls({}),
    null as any,
    null as any,
  )
  const oplogs = processor.mergeOplogs([
    {
      ts: new Timestamp(0, 0),
      op: 'u',
      ns: 'example1',
      o: {
        'field0.field1': 1,
        $set: {
          'field0.field2': 1,
        },
      },
      o2: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
      },
    },
    {
      ts: new Timestamp(0, 1),
      op: 'd',
      ns: 'example1',
      o: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
      },
    },
  ])
  t.deepEqual(oplogs, [
    {
      ts: new Timestamp(0, 1),
      op: 'd',
      ns: 'example1',
      o: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
      },
    },
  ])
})

test('mergeOplogs insert then delete', t => {
  const processor = new Processor(
    {
      transform: {
        mapping: {
          'field0.field1': 'field1',
          'field0.field2': 'field2',
        },
      },
    } as any,
    new Controls({}),
    null as any,
    null as any,
  )
  const oplogs = processor.mergeOplogs([
    {
      ts: new Timestamp(0, 0),
      op: 'i',
      ns: 'example1',
      o: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
        field0: 1,
      },
    },
    {
      ts: new Timestamp(0, 1),
      op: 'd',
      ns: 'example1',
      o: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
      },
    },
  ])
  t.deepEqual(oplogs, [])
})

test('mergeOplogs insert then update then update', t => {
  const processor = new Processor(
    {
      transform: {
        mapping: {
          'field0.field1': 'field1',
        },
      },
    } as any,
    new Controls({}),
    null as any,
    null as any,
  )
  const oplogs = processor.mergeOplogs([
    {
      ts: new Timestamp(0, 0),
      op: 'i',
      ns: 'example1',
      o: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
        'field0.field1': 0,
      },
    },
    {
      ts: new Timestamp(0, 2),
      op: 'u',
      ns: 'example1',
      o: {
        $set: {
          'field0.field1': 2,
        },
      },
      o2: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
      },
    },
    {
      ts: new Timestamp(0, 1),
      op: 'u',
      ns: 'example1',
      o: {
        $set: {
          'field0.field1': 1,
        },
      },
      o2: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
      },
    },
  ])
  t.deepEqual(oplogs, [
    {
      ts: new Timestamp(0, 2),
      op: 'i',
      ns: 'example1',
      o: {
        _id: new ObjectID('aaaaaaaaaaaaaaaaaaaaaaaa'),
        'field0.field1': 2,
      },
    },
  ])
})
