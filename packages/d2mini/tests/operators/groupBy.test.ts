import { describe, test, expect } from 'vitest'
import { D2 } from '../../src/d2.js'
import { MultiSet } from '../../src/multiset.js'
import {
  groupBy,
  sum,
  count,
  avg,
  min,
  max,
  median,
  mode,
} from '../../src/operators/groupBy.js'
import { output } from '../../src/operators/index.js'

describe('Operators', () => {
  describe('GroupBy operation', () => {
    test('with no aggregate', () => {
      const graph = new D2()
      const input = graph.newInput<{
        category: string
        amount: number
      }>()
      let latestMessage: any = null

      input.pipe(
        groupBy((data) => ({ category: data.category })),
        output((message) => {
          latestMessage = message
        }),
      )

      graph.finalize()

      // Initial data
      input.sendData(
        new MultiSet([
          [{ category: 'A', amount: 10 }, 1],
          [{ category: 'A', amount: 20 }, 1],
          [{ category: 'B', amount: 30 }, 1],
        ]),
      )
      graph.run()

      // Verify we have the latest message
      expect(latestMessage).not.toBeNull()

      const result = latestMessage.getInner()

      const expectedResult = [
        [
          [
            `{"category":"A"}`,
            {
              category: 'A',
            },
          ],
          1,
        ],
        [
          [
            `{"category":"B"}`,
            {
              category: 'B',
            },
          ],
          1,
        ],
      ]

      expect(result).toEqual(expectedResult)
    })

    test('with single sum aggregate', () => {
      const graph = new D2()
      const input = graph.newInput<{
        category: string
        amount: number
      }>()
      let latestMessage: any = null

      input.pipe(
        groupBy((data) => ({ category: data.category }), {
          total: sum((data) => data.amount),
        }),
        output((message) => {
          latestMessage = message
        }),
      )

      graph.finalize()

      // Initial data
      input.sendData(
        new MultiSet([
          [{ category: 'A', amount: 10 }, 1],
          [{ category: 'A', amount: 20 }, 1],
          [{ category: 'B', amount: 30 }, 1],
        ]),
      )
      graph.run()

      // Verify we have the latest message
      expect(latestMessage).not.toBeNull()

      const result = latestMessage.getInner()

      const expectedResult = [
        [
          [
            `{"category":"A"}`,
            {
              total: 30,
              category: 'A',
            },
          ],
          1,
        ],
        [
          [
            `{"category":"B"}`,
            {
              total: 30,
              category: 'B',
            },
          ],
          1,
        ],
      ]

      expect(result).toEqual(expectedResult)
    })

    test('with sum and count aggregates', async () => {
      const graph = new D2()
      const input = graph.newInput<{
        category: string
        region: string
        amount: number
      }>()
      let latestMessage: any = null
      const messages: MultiSet<any>[] = []

      input.pipe(
        groupBy(
          (data) => ({
            category: data.category,
            region: data.region,
          }),
          {
            total: sum((data) => data.amount),
            count: count(),
          },
        ),
        output((message) => {
          latestMessage = message
          messages.push(message)
        }),
      )

      graph.finalize()

      // Initial data
      input.sendData(
        new MultiSet([
          [{ category: 'A', region: 'East', amount: 10 }, 1],
          [{ category: 'A', region: 'East', amount: 20 }, 1],
          [{ category: 'A', region: 'West', amount: 30 }, 1],
          [{ category: 'B', region: 'East', amount: 40 }, 1],
        ]),
      )
      graph.run()

      // Verify we have the latest message
      expect(latestMessage).not.toBeNull()

      const expectedResult = [
        [
          [
            '{"category":"A","region":"East"}',
            {
              total: 30,
              count: 2,
              category: 'A',
              region: 'East',
            },
          ],
          1,
        ],
        [
          [
            '{"category":"A","region":"West"}',
            {
              total: 30,
              count: 1,
              category: 'A',
              region: 'West',
            },
          ],
          1,
        ],
        [
          [
            '{"category":"B","region":"East"}',
            {
              total: 40,
              count: 1,
              category: 'B',
              region: 'East',
            },
          ],
          1,
        ],
      ]

      expect(latestMessage.getInner()).toEqual(expectedResult)

      // --- Add a new record ---
      input.sendData(
        new MultiSet([
          [{ category: 'A', region: 'East', amount: 15 }, 1],
          [{ category: 'B', region: 'West', amount: 25 }, 1],
        ]),
      )

      graph.run()

      const expectedAddResult = [
        [
          [
            '{"category":"A","region":"East"}',
            {
              category: 'A',
              region: 'East',
              total: 45,
              count: 3,
            },
          ],
          1,
        ],
        [
          [
            '{"category":"A","region":"East"}',
            {
              category: 'A',
              region: 'East',
              total: 30,
              count: 2,
            },
          ],
          -1,
        ],
        [
          [
            '{"category":"B","region":"West"}',
            {
              category: 'B',
              region: 'West',
              total: 25,
              count: 1,
            },
          ],
          1,
        ],
      ]

      expect(latestMessage.getInner()).toEqual(expectedAddResult)

      // --- Delete a record ---
      input.sendData(
        new MultiSet([
          [{ category: 'A', region: 'East', amount: 20 }, -1], // Remove one of the A/East records
        ]),
      )
      graph.run()

      const expectedDeleteResult = [
        [
          [
            '{"category":"A","region":"East"}',
            {
              category: 'A',
              region: 'East',
              total: 25,
              count: 2,
            },
          ],
          1,
        ],
        [
          [
            '{"category":"A","region":"East"}',
            {
              category: 'A',
              region: 'East',
              total: 45,
              count: 3,
            },
          ],
          -1,
        ],
      ]

      expect(latestMessage.getInner()).toEqual(expectedDeleteResult)
    })

    test('with avg and count aggregates', () => {
      const graph = new D2()
      const input = graph.newInput<{
        category: string
        amount: number
      }>()
      let latestMessage: any = null
      const messages: MultiSet<any>[] = []

      input.pipe(
        groupBy((data) => ({ category: data.category }), {
          average: avg((data) => data.amount),
          count: count(),
        }),
        output((message) => {
          latestMessage = message
          messages.push(message)
        }),
      )

      graph.finalize()

      // Initial data
      input.sendData(
        new MultiSet([
          [{ category: 'A', amount: 10 }, 1],
          [{ category: 'A', amount: 20 }, 1],
          [{ category: 'B', amount: 30 }, 1],
        ]),
      )
      graph.run()

      // Verify we have the latest message
      expect(latestMessage).not.toBeNull()

      const expectedResult = [
        [
          [
            '{"category":"A"}',
            {
              category: 'A',
              average: 15,
              count: 2,
            },
          ],
          1,
        ],
        [
          [
            '{"category":"B"}',
            {
              category: 'B',
              average: 30,
              count: 1,
            },
          ],
          1,
        ],
      ]

      expect(latestMessage.getInner()).toEqual(expectedResult)

      // --- Add a new record ---
      input.sendData(
        new MultiSet([
          [{ category: 'A', amount: 30 }, 1],
          [{ category: 'C', amount: 50 }, 1],
        ]),
      )
      graph.run()

      const expectedAddResult = [
        [
          [
            '{"category":"A"}',
            {
              category: 'A',
              average: 20,
              count: 3,
            },
          ],
          1,
        ],
        [
          [
            '{"category":"A"}',
            {
              category: 'A',
              average: 15,
              count: 2,
            },
          ],
          -1,
        ],
        [
          [
            '{"category":"C"}',
            {
              category: 'C',
              average: 50,
              count: 1,
            },
          ],
          1,
        ],
      ]

      expect(latestMessage.getInner()).toEqual(expectedAddResult)

      // --- Delete a record ---
      input.sendData(
        new MultiSet([
          [{ category: 'A', amount: 10 }, -1], // Remove the first A record
        ]),
      )
      graph.run()

      const expectedDeleteResult = [
        [
          [
            '{"category":"A"}',
            {
              category: 'A',
              average: 25,
              count: 2,
            },
          ],
          1,
        ],
        [
          [
            '{"category":"A"}',
            {
              category: 'A',
              average: 20,
              count: 3,
            },
          ],
          -1,
        ],
      ]

      expect(latestMessage.getInner()).toEqual(expectedDeleteResult)
    })

    test('with min and max aggregates', () => {
      const graph = new D2()
      const input = graph.newInput<{
        category: string
        amount: number
      }>()
      let latestMessage: any = null

      input.pipe(
        groupBy((data) => ({ category: data.category }), {
          minimum: min((data) => data.amount),
          maximum: max((data) => data.amount),
        }),
        output((message) => {
          latestMessage = message
        }),
      )

      graph.finalize()

      // Initial data
      input.sendData(
        new MultiSet([
          [{ category: 'A', amount: 10 }, 1],
          [{ category: 'A', amount: 20 }, 1],
          [{ category: 'A', amount: 5 }, 1],
          [{ category: 'B', amount: 30 }, 1],
          [{ category: 'B', amount: 15 }, 1],
        ]),
      )

      // Run the graph to process all messages
      graph.run()

      expect(latestMessage).not.toBeNull()

      const expectedResult = [
        [
          [
            '{"category":"A"}',
            {
              category: 'A',
              minimum: 5,
              maximum: 20,
            },
          ],
          1,
        ],
        [
          [
            '{"category":"B"}',
            {
              category: 'B',
              minimum: 15,
              maximum: 30,
            },
          ],
          1,
        ],
      ]

      expect(latestMessage.getInner()).toEqual(expectedResult)
    })

    test('with median and mode aggregates', () => {
      const graph = new D2()
      const input = graph.newInput<{
        category: string
        amount: number
      }>()
      let latestMessage: any = null

      input.pipe(
        groupBy((data) => ({ category: data.category }), {
          middle: median((data) => data.amount),
          mostFrequent: mode((data) => data.amount),
        }),
        output((message) => {
          latestMessage = message
        }),
      )

      graph.finalize()

      // Initial data with pattern designed to test median and mode
      input.sendData(
        new MultiSet([
          // Category A: [10, 20, 20, 30, 50]
          // Median: 20, Mode: 20
          [{ category: 'A', amount: 10 }, 1],
          [{ category: 'A', amount: 20 }, 2], // Added twice to test mode
          [{ category: 'A', amount: 30 }, 1],
          [{ category: 'A', amount: 50 }, 1],

          // Category B: [5, 10, 15, 20]
          // Median: 12.5 (average of 10 and 15), Mode: 5, 10, 15, 20 (all appear once)
          [{ category: 'B', amount: 5 }, 1],
          [{ category: 'B', amount: 10 }, 1],
          [{ category: 'B', amount: 15 }, 1],
          [{ category: 'B', amount: 20 }, 1],
        ]),
      )

      // Run the graph to process all messages
      graph.run()

      expect(latestMessage).not.toBeNull()

      const expectedResult = [
        [
          [
            '{"category":"A"}',
            {
              category: 'A',
              middle: 20,
              mostFrequent: 20,
            },
          ],
          1,
        ],
        [
          [
            '{"category":"B"}',
            {
              category: 'B',
              middle: 12.5,
              mostFrequent: 5, // First encountered value with highest frequency (all values appear once)
            },
          ],
          1,
        ],
      ]

      expect(latestMessage.getInner()).toEqual(expectedResult)
    })
  })
})
