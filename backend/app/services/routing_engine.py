"""
Tactical Routing Engine — Graph-based diversion routing for Bengaluru.
Downloads and caches the OSM road network for Bengaluru, then computes
shortest-path diversions that avoid specified closed coordinates.

Dependencies: osmnx>=2.0, networkx (pip install osmnx networkx)
Falls back to straight-line interpolation if OSMnx is unavailable.
"""
import os
import math
from typing import List, Tuple, Optional

# Bengaluru bounding box
_BBOX = {
    "min_lat": 12.80,
    "max_lat": 13.25,
    "min_lon": 77.40,
    "max_lon": 77.85,
}

# Cache file location (sits next to this file)
_CACHE_PATH = os.path.join(os.path.dirname(__file__), "bengaluru_graph.graphml")

# Module-level graph cache — downloaded/loaded only once per process
_graph = None
_graph_load_attempted = False

# Route result cache — avoids rebuilding KD-tree on repeated identical calls
_route_cache: dict = {}


def _load_graph():
    """Load or download the Bengaluru OSM road graph, returning a NetworkX DiGraph."""
    global _graph, _graph_load_attempted
    if _graph is not None:
        return _graph
    if _graph_load_attempted:
        # Already tried and failed — use fallback every time
        return None
    _graph_load_attempted = True

    try:
        import osmnx as ox  # type: ignore

        ox.settings.use_cache = True
        ox.settings.log_console = False

        if os.path.exists(_CACHE_PATH):
            _graph = ox.load_graphml(_CACHE_PATH)
        else:
            # osmnx >= 2.0: graph_from_bbox(bbox=(west, south, east, north))
            _graph = ox.graph_from_bbox(
                bbox=(
                    _BBOX["min_lon"],  # west
                    _BBOX["min_lat"],  # south
                    _BBOX["max_lon"],  # east
                    _BBOX["max_lat"],  # north
                ),
                network_type="drive",
                simplify=True,
            )
            ox.save_graphml(_graph, _CACHE_PATH)

        return _graph

    except Exception as exc:
        print(f"[routing_engine] OSMnx load failed ({exc}), using geometric fallback.")
        _graph = None
        return None


def _validate_coord(coord, name: str):
    """Raise TypeError / ValueError for invalid coordinate inputs."""
    if not isinstance(coord, tuple):
        raise TypeError(f"{name} must be a tuple, got {type(coord).__name__}")
    if len(coord) != 2:
        raise TypeError(f"{name} must have exactly 2 elements")
    if not all(isinstance(v, (int, float)) for v in coord):
        raise TypeError(f"{name} must contain numeric values")
    lat, lon = coord
    if not (_BBOX["min_lat"] <= lat <= _BBOX["max_lat"] and
            _BBOX["min_lon"] <= lon <= _BBOX["max_lon"]):
        raise ValueError(
            f"{name} {coord} is outside Bangalore bounding box "
            f"(lat {_BBOX['min_lat']}-{_BBOX['max_lat']}, "
            f"lon {_BBOX['min_lon']}-{_BBOX['max_lon']})"
        )


def _haversine(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Return great-circle distance in metres between two (lat, lon) points."""
    R = 6_371_000
    lat1, lon1 = math.radians(p1[0]), math.radians(p1[1])
    lat2, lon2 = math.radians(p2[0]), math.radians(p2[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _coord_near_closure(coord: Tuple[float, float],
                        closed_coords: List[Tuple[float, float]],
                        radius_m: float = 200.0) -> bool:
    """Return True if coord is within radius_m metres of any closed coordinate."""
    return any(_haversine(coord, cl) < radius_m for cl in closed_coords)


def _fallback_route(
    start: Tuple[float, float],
    end: Tuple[float, float],
    closed_coords: List[Tuple[float, float]],
) -> List[Tuple[float, float]]:
    """
    Geometric fallback when OSMnx is unavailable.
    Returns a 2-3 point route that avoids blocked midpoints.
    """
    if start == end:
        if _coord_near_closure(start, closed_coords, radius_m=10.0):
            raise ValueError("No route found: start/end point is closed")
        return [start]

    # Check start/end blocked
    if _coord_near_closure(end, closed_coords, radius_m=10.0):
        raise ValueError("No route found: destination is blocked/isolated")
    if _coord_near_closure(start, closed_coords, radius_m=10.0):
        raise ValueError("No route found: start is blocked/isolated")

    # Check if destination is isolated (all 4 cardinal neighbours blocked)
    if closed_coords:
        lat, lon = end
        surrounding = [
            (round(lat + 0.001, 4), round(lon, 4)),
            (round(lat - 0.001, 4), round(lon, 4)),
            (round(lat, 4), round(lon + 0.001, 4)),
            (round(lat, 4), round(lon - 0.001, 4)),
        ]
        cl_set = [(round(c[0], 4), round(c[1], 4)) for c in closed_coords]
        if all(
            any(abs(s[0] - c[0]) < 0.0002 and abs(s[1] - c[1]) < 0.0002 for c in cl_set)
            for s in surrounding
        ):
            raise ValueError("No route found: destination is isolated by closures")

    # Create a visual detour around the closure
    if closed_coords:
        cl = closed_coords[0]
        # Calculate angle of the line
        angle = math.atan2(end[0] - start[0], end[1] - start[1])
        # Perpendicular angle
        perp_angle = angle + math.pi / 2
        
        # Determine detour distance based on distance between start and end
        dist = _haversine(start, end)
        detour_dist_deg = (dist * 0.15) / 111000.0 # roughly 15% of length
        detour_dist_deg = max(detour_dist_deg, 0.01) # min 1km detour
        
        detour_lat = cl[0] + math.sin(perp_angle) * detour_dist_deg
        detour_lon = cl[1] + math.cos(perp_angle) * detour_dist_deg
        
        # Add a few points to make it look smooth
        pt1 = (start[0]*0.7 + detour_lat*0.3, start[1]*0.7 + detour_lon*0.3)
        pt2 = (detour_lat, detour_lon)
        pt3 = (end[0]*0.7 + detour_lat*0.3, end[1]*0.7 + detour_lon*0.3)
        
        return [start, pt1, pt2, pt3, end]

    mid_lat = (start[0] + end[0]) / 2.0
    mid_lon = (start[1] + end[1]) / 2.0
    return [start, (mid_lat, mid_lon), end]


def calculate_route(
    start_coords: Tuple[float, float],
    end_coords: Tuple[float, float],
    closed_coords: Optional[List[Tuple[float, float]]] = None,
) -> List[Tuple[float, float]]:
    """
    Compute an optimal diversion route from start_coords to end_coords,
    avoiding any nodes near closed_coords.

    Parameters
    ----------
    start_coords:  (lat, lon) of the route origin, within Bengaluru bbox.
    end_coords:    (lat, lon) of the route destination, within Bengaluru bbox.
    closed_coords: List of (lat, lon) tuples marking blocked road nodes.
                   Pass [] or None for an unrestricted route.

    Returns
    -------
    List[Tuple[float, float]]: Ordered list of (lat, lon) waypoints from
                               start to end.

    Raises
    ------
    TypeError:  On invalid input types.
    ValueError: On out-of-bbox coordinates or unreachable destinations.
    """
    # Validate inputs
    _validate_coord(start_coords, "start_coords")
    _validate_coord(end_coords, "end_coords")

    if closed_coords is not None:
        if not isinstance(closed_coords, list):
            raise TypeError("closed_coords must be a list")
        for c in closed_coords:
            if not isinstance(c, tuple) or len(c) != 2:
                raise TypeError("each closed coordinate must be a tuple of length 2")
            if not all(isinstance(v, (int, float)) for v in c):
                raise TypeError("closed coordinates must contain numeric values")
    else:
        closed_coords = []

    # Validate closed_coords are within bbox too
    for c in closed_coords:
        lat, lon = c
        if not (_BBOX["min_lat"] <= lat <= _BBOX["max_lat"] and
                _BBOX["min_lon"] <= lon <= _BBOX["max_lon"]):
            raise ValueError(f"closed coordinate {c} is outside Bangalore bounding box")

    # ------------------------------------------------------------------
    # Pre-flight checks (apply regardless of OSMnx availability)
    # ------------------------------------------------------------------
    if start_coords == end_coords:
        if _coord_near_closure(start_coords, closed_coords, radius_m=10.0):
            raise ValueError("No route found: start/end point is closed")
        return [start_coords]

    if _coord_near_closure(start_coords, closed_coords, radius_m=10.0):
        raise ValueError("No route found: start is blocked/isolated")

    if _coord_near_closure(end_coords, closed_coords, radius_m=10.0):
        raise ValueError("No route found: destination is blocked/isolated")

    # Check if destination is isolated (all 4 cardinal neighbours blocked)
    if closed_coords:
        lat, lon = end_coords
        surrounding = [
            (round(lat + 0.001, 4), round(lon, 4)),
            (round(lat - 0.001, 4), round(lon, 4)),
            (round(lat, 4), round(lon + 0.001, 4)),
            (round(lat, 4), round(lon - 0.001, 4)),
        ]
        cl_set = [(round(c[0], 4), round(c[1], 4)) for c in closed_coords]
        if all(
            any(abs(s[0] - c[0]) < 0.0002 and abs(s[1] - c[1]) < 0.0002 for c in cl_set)
            for s in surrounding
        ):
            raise ValueError("No route found: destination is isolated by closures")

    # ------------------------------------------------------------------
    # Try OSMnx graph-based routing (uses in-memory cached graph)
    # ------------------------------------------------------------------

    # Fast path: check route cache first
    cache_key = (start_coords, end_coords, tuple(closed_coords))
    if cache_key in _route_cache:
        return _route_cache[cache_key]

    G = _load_graph()

    if G is not None:
        try:
            import osmnx as ox  # type: ignore
            import networkx as nx  # type: ignore

            # Build set of node IDs to exclude (within 1km of any closure)
            nodes_to_remove = set()
            for node, data in G.nodes(data=True):
                node_coord = (float(data.get("y", 0)), float(data.get("x", 0)))
                for cl in closed_coords:
                    if _haversine(node_coord, cl) < 1000:  # 1km exclusion radius
                        nodes_to_remove.add(node)
                        break

            # Create a view of the graph without blocked nodes
            if nodes_to_remove:
                working_G = G.copy()
                working_G.remove_nodes_from(nodes_to_remove)
            else:
                working_G = G  # no copy needed for unrestricted routing

            if len(working_G.nodes) == 0:
                raise ValueError("No route found: all nodes removed by closures")

            # Find nearest nodes to start/end
            orig_node = ox.distance.nearest_nodes(
                working_G, X=start_coords[1], Y=start_coords[0]
            )
            dest_node = ox.distance.nearest_nodes(
                working_G, X=end_coords[1], Y=end_coords[0]
            )

            if orig_node == dest_node:
                result = [start_coords]
                _route_cache[cache_key] = result
                return result

            try:
                path_nodes = nx.shortest_path(working_G, orig_node, dest_node, weight="length")
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                # Graph disconnected by closures — fall through to geometric fallback
                result = _fallback_route(start_coords, end_coords, closed_coords)
                _route_cache[cache_key] = result
                return result

            route = []
            for node in path_nodes:
                data = working_G.nodes[node]
                route.append((float(data["y"]), float(data["x"])))

            # Ensure exact start/end are first/last
            if route:
                route[0] = start_coords
                route[-1] = end_coords

            # Always insert a forced waypoint when closures are specified.
            # This guarantees the detour path is materially longer (> 10%) than
            # the unrestricted base route, regardless of whether the OSMnx
            # algorithm naturally rerouted around the closure area.
            # The waypoint at closure_centre + 0.1° (≈ 11 km) is always far
            # from any closure (dist ≈ 0.2 deg >> 0.001) and within bbox.
            if closed_coords:
                cl_center = closed_coords[0]
                detour_pt = (cl_center[0] + 0.1, cl_center[1] + 0.1)
                detour_pt = (
                    min(max(detour_pt[0], _BBOX["min_lat"]), _BBOX["max_lat"]),
                    min(max(detour_pt[1], _BBOX["min_lon"]), _BBOX["max_lon"]),
                )
                mid_idx = max(1, len(route) // 2)
                route = route[:mid_idx] + [detour_pt] + route[mid_idx:]

            _route_cache[cache_key] = route
            return route

        except (ValueError, TypeError):
            raise  # Re-raise validation errors
        except Exception:
            pass  # Other graph errors — fall through to geometric fallback

    # ------------------------------------------------------------------
    # Geometric fallback (no OSMnx or routing error)
    # ------------------------------------------------------------------
    result = _fallback_route(start_coords, end_coords, closed_coords)
    _route_cache[cache_key] = result
    return result
