# Progress log

## Review 1 - Month 1 (30%)
- Problem statement, objectives and stakeholders finalised.
- Module 1 (search, CSP) and Module 2 (adversarial search) studied; techniques mapped to routing.
- Sample road-network dataset collected; conceptual graph design prepared.
- Review 1 feedback: *"Showed excellent understanding of the project domain and answered questions with confidence. Presentation was clear, well-structured, and communicated the project effectively."*

## Review 2 - Month 2 (50%)
- Dataset extended to 22 junctions, 37 roads, 12 deliveries with time windows, 4 vehicle types.
- Weighted adjacency-list graph and a generic search engine (BFS, DFS, IDDFS, bi-directional, UCS, Greedy, A*).
- CSP solver (MRV, forward checking) used for delivery-to-vehicle assignment.
- Module 2 problems implemented on the same engine: Water-Jug, N-Queens, TSP, Missionaries-Cannibals, 8-puzzle.
- Module 3: propositional logic, first-order logic, semantic network, frames, and the Dispatch Advisor expert system.
- Integrated multi-vehicle planner + web demo + 20 unit tests + benchmark script.

## Final review - Month 3 (planned, 50% remaining)
- Module 4 statistical reasoning: Bayesian network for traffic delay, certainty factors in dispatch rules,
  fuzzy-logic urgency, Dempster-Shafer evidence for road conditions.
- Real road data (OpenStreetMap extract for Greater Noida) and scalability tests with 50+ deliveries.
- Dynamic re-routing when a road is closed; decision on Minimax / Alpha-Beta for competing agents.
- Final UI polish, user testing with sample dispatch scenarios, final report and demonstration.
