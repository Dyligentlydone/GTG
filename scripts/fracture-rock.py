# fracture-rock.py — split a rock GLB into exactly 120 separate mesh chunks.
#
#   blender --background --python scripts/fracture-rock.py -- <in.glb> <out.glb> [pieces] [seed] [statue.glb]
#
# Optional 5th arg: a statue GLB in the SAME coordinate frame (figure standing
# inside the rock). The statue — inflated a few percent — is boolean-subtracted
# from the rock before fracturing, so the 120 chunks form a hollow shell around
# it and a falling chunk can never clip through the figure.
#
# Method: voxel-remesh the input (guarantees a watertight, evenly-dense solid),
# scatter `pieces` seed points inside it on a jittered grid (roughly equal
# volumes, no slivers), then for each seed bisect the solid with the midplanes
# to its neighbours — the voronoi cell of that seed inside the rock. Chunks are
# named rock_001…rock_NNN and exported as one GLB.
import sys
import os
import bpy
from mathutils import Vector
import bmesh
import random
import math

argv = sys.argv[sys.argv.index('--') + 1:]
IN_PATH, OUT_PATH = argv[0], argv[1]
N_PIECES = int(argv[2]) if len(argv) > 2 else 120
SEED = int(argv[3]) if len(argv) > 3 else 7
STATUE_PATH = argv[4] if len(argv) > 4 else None
random.seed(SEED)

# ---------- import ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN_PATH)
rock = max((o for o in bpy.context.scene.objects if o.type == 'MESH'),
           key=lambda o: o.dimensions.length)
bpy.ops.object.select_all(action='DESELECT')
rock.select_set(True)
bpy.context.view_layer.objects.active = rock

# ---------- base solid ----------
# Two modes:
#   default  — voxel-remesh first (watertight guaranteed; surface fidelity =
#              voxel density, so dense remesh = heavy chunks)
#   SKIP_REMESH=1 — fracture the source mesh directly (full original surface
#              fidelity; requires the source to be near-manifold). Pair with
#              PRE_DECIMATE=<ratio> to lighten the source first — safe because
#              decimation happens while the rock is still ONE unified mesh, so
#              seams can't gap. NEVER decimate chunks after fracturing.
voxel = rock.dimensions.length / float(os.environ.get('VOX_DIV', '70'))
if os.environ.get('SKIP_REMESH'):
    ratio = float(os.environ.get('PRE_DECIMATE', '1'))
    if ratio < 1:
        bpy.context.view_layer.objects.active = rock
        dec = rock.modifiers.new('dec', 'DECIMATE')
        dec.ratio = ratio
        bpy.ops.object.modifier_apply(modifier=dec.name)
        rock.data.update()
        print(f'PRE_DECIMATE: source -> {len(rock.data.vertices)} verts')
else:
    mod = rock.modifiers.new('voxel', 'REMESH')
    mod.mode = 'VOXEL'
    mod.voxel_size = voxel
    bpy.context.view_layer.objects.active = rock
    bpy.ops.object.modifier_apply(modifier=mod.name)
    rock.data.update()

# ---------- carve the statue cavity so chunks never intersect the figure ----------
if STATUE_PATH:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=STATUE_PATH)
    statue = max((o for o in set(bpy.context.scene.objects) - before if o.type == 'MESH'),
                 key=lambda o: o.dimensions.length)
    # inflate ~3.5% so the shell has clearance around the figure
    statue.scale = (statue.scale.x * 1.035, statue.scale.y * 1.035, statue.scale.z * 1.035)
    bpy.ops.object.select_all(action='DESELECT')
    statue.select_set(True)
    bpy.context.view_layer.objects.active = statue
    bpy.ops.object.transform_apply(scale=True)
    # watertight for a reliable boolean
    sm = statue.modifiers.new('voxel', 'REMESH')
    sm.mode = 'VOXEL'
    sm.voxel_size = voxel
    bpy.ops.object.modifier_apply(modifier=sm.name)

    bpy.context.view_layer.objects.active = rock
    diff = rock.modifiers.new('cavity', 'BOOLEAN')
    diff.operation = 'DIFFERENCE'
    diff.solver = 'EXACT'
    diff.object = statue
    bpy.ops.object.modifier_apply(modifier=diff.name)
    rock.data.update()
    bpy.data.objects.remove(statue)
    print('CAVITY: statue subtracted (3.5% clearance)')

bbox = [rock.matrix_world @ Vector(c) for c in rock.bound_box]
lo = Vector((min(v.x for v in bbox), min(v.y for v in bbox), min(v.z for v in bbox)))
hi = Vector((max(v.x for v in bbox), max(v.y for v in bbox), max(v.z for v in bbox)))
size = hi - lo
depsgraph = bpy.context.evaluated_depsgraph_get()
rock_eval = rock.evaluated_get(depsgraph)


def inside(p: Vector) -> bool:
    # odd crossings along +X = inside (retry other axes on a tie/edge case)
    hits = 0
    origin = p - Vector((size.x * 3, 0, 0))
    for axis in (Vector((1, 0, 0)), Vector((0, 1, 0.3)), Vector((0, 0.4, 1))):
        hits = 0
        o = origin.copy()
        for _ in range(64):
            ok, loc, *_ = rock_eval.ray_cast(o, axis)
            if not ok:
                break
            hits += 1
            o = loc + axis * voxel * 0.5
        if hits:  # first axis that hits anything decides
            return hits % 2 == 1
    return False


# ---------- jittered-grid seed points inside the solid ----------
# cell dims as close to cubic as the box allows
def grid_dims(n, s):
    base = round(n ** (1 / 3))
    best = (1, 1, n)
    for a in range(1, n + 1):
        for b in range(1, n + 1):
            if a * b > n:
                continue
            c = math.ceil(n / (a * b))
            aspect = max(a * s.x, b * s.y, c * s.z) / max(0.001, min(a * s.x, b * s.y, c * s.z))
            if a * b * c >= n and aspect < (max(best[0] * s.x, best[1] * s.y, best[2] * s.z) / max(0.001, min(best[0] * s.x, best[1] * s.y, best[2] * s.z))):
                best = (a, b, c)
    return best


gx, gy, gz = grid_dims(N_PIECES, size)
spacing = min(size.x / gx, size.y / gy, size.z / gz)
cells = [(i, j, k) for i in range(gx) for j in range(gy) for k in range(gz)]
random.shuffle(cells)
cells = cells[:N_PIECES]

def force_inside(p: Vector) -> Vector:
    if inside(p):
        return p
    # shrink toward the bbox centre until the point lands in the solid
    centre = (lo + hi) * 0.5
    for _ in range(40):
        p = p.lerp(centre, 0.12)
        if inside(p):
            return p
    return centre


seeds = []
for (i, j, k) in cells:
    c = Vector((lo.x + (i + 0.5) * size.x / gx,
                lo.y + (j + 0.5) * size.y / gy,
                lo.z + (k + 0.5) * size.z / gz))
    p = c + Vector((random.uniform(-0.3, 0.3) * size.x / gx,
                    random.uniform(-0.3, 0.3) * size.y / gy,
                    random.uniform(-0.3, 0.3) * size.z / gz))
    seeds.append(force_inside(p))

# force_inside can collapse several bad seeds onto the same spot — spread them
for _ in range(3):
    for i, a in enumerate(seeds):
        for j in range(i + 1, len(seeds)):
            if (seeds[j] - a).length < spacing * 0.35:
                seeds[j] = force_inside(seeds[j] + Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))) * spacing * 0.6)

# ---------- voronoi fracture via bisect ----------
def cell_mesh(seed, neighbors):
    bm = bmesh.new()
    bm.from_mesh(rock.data)
    for other in neighbors:
        n = (other - seed)
        if n.length < 1e-6:
            continue
        n.normalize()
        co = (seed + other) * 0.5
        # keep the half-space containing the seed: dot(seed-co, n) < 0
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=n,
                               clear_outer=True, clear_inner=False)
        # cap the fresh cut so each chunk is a closed solid
        boundary = [e for e in bm.edges if e.is_boundary]
        if boundary:
            bmesh.ops.triangle_fill(bm, use_beauty=True, edges=boundary)
    # merge coplanar faces + weld verts — interior fracture faces are flat,
    # this keeps the GLB small without touching the silhouette
    bmesh.ops.dissolve_limit(bm, angle_limit=0.09,
                             verts=bm.verts[:], edges=bm.edges[:])
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=voxel * 0.02)
    m = bpy.data.meshes.new('chunk')
    bm.to_mesh(m)
    bm.free()
    # smooth shading → the assembled chunks read as one continuous marble
    # surface; fracture lines stay only as hairline seams, like real breaks
    for p in m.polygons:
        p.use_smooth = True
    return m


src_mat = None if os.environ.get('NO_MATS') else (rock.data.materials[0] if rock.data.materials else None)
radius = spacing * 1.9
chunks = []
for idx, s in enumerate(seeds):
    neighbors = [o for o in seeds if o is not s and (o - s).length < radius]
    mesh = cell_mesh(s, neighbors)
    if len(mesh.polygons) == 0:
        continue
    if src_mat:
        mesh.materials.append(src_mat)
    ob = bpy.data.objects.new(f'rock_{idx + 1:03d}', mesh)
    bpy.context.scene.collection.objects.link(ob)
    chunks.append(ob)

# drop slivers (< 20% of mean volume): their space stays, neighbors already cover it
vols = []
for ob in chunks:
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    vols.append(bm.calc_volume(signed=True) if hasattr(bm, 'calc_volume') else abs(
        sum(f.calc_area() * f.normal.dot(f.verts[0].co) / 3 for f in bm.faces)))
    bm.free()
mean_v = sum(abs(v) for v in vols) / max(1, len(vols))
kept = [ob for ob, v in zip(chunks, vols) if abs(v) > mean_v * 0.2]
for ob, v in zip(chunks, vols):
    if abs(v) <= mean_v * 0.2:
        bpy.data.objects.remove(ob)


def volume_of(mesh) -> float:
    bm = bmesh.new()
    bm.from_mesh(mesh)
    v = abs(sum(f.calc_area() * f.normal.dot(f.verts[0].co) / 3 for f in bm.faces))
    bm.free()
    return v


def centroid_of(obj) -> Vector:
    c = Vector()
    for v in obj.data.vertices:
        c += v.co
    return c / max(1, len(obj.data.vertices))


# top up to exactly N_PIECES: bisect the largest chunk with a random plane
while len(kept) < N_PIECES:
    big = max(kept, key=lambda o: volume_of(o.data))
    n = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))).normalized()
    co = centroid_of(big)
    bm = bmesh.new()
    bm.from_mesh(big.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
                           plane_co=co, plane_no=n, clear_outer=True)
    boundary = [e for e in bm.edges if e.is_boundary]
    if boundary:
        bmesh.ops.triangle_fill(bm, use_beauty=True, edges=boundary)
    half = bpy.data.meshes.new('chunk')
    bm.to_mesh(half)
    bm.free()

    bm2 = bmesh.new()
    bm2.from_mesh(big.data)
    bmesh.ops.bisect_plane(bm2, geom=bm2.verts[:] + bm2.edges[:] + bm2.faces[:],
                           plane_co=co, plane_no=n, clear_inner=True)
    boundary = [e for e in bm2.edges if e.is_boundary]
    if boundary:
        bmesh.ops.triangle_fill(bm2, use_beauty=True, edges=boundary)
    bm2.to_mesh(big.data)
    bm2.free()

    if src_mat:
        half.materials.append(src_mat)
    ob = bpy.data.objects.new('chunk', half)
    bpy.context.scene.collection.objects.link(ob)
    kept.append(ob)


for i, ob in enumerate(kept):
    ob.name = f'rock_{i + 1:03d}'

rock.hide_set(True)
bpy.ops.object.select_all(action='DESELECT')
for ob in kept:
    ob.select_set(True)

print(f'FRACTURED: {len(kept)} chunks (target {N_PIECES})')
bpy.ops.export_scene.gltf(filepath=OUT_PATH, export_format='GLB', use_selection=True,
                          export_materials='NONE' if os.environ.get('NO_MATS') else 'EXPORT',
                          export_draco_mesh_compression_enable=True)
print(f'WROTE {OUT_PATH}')
