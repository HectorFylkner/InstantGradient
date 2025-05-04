// Maximum number of stops supported by this shader
// This MUST match the constant used when creating the buffer layout in gpu.ts
const MAX_STOPS: u32 = 8u;

struct Stop {
  pos: f32,
  r: f32,
  g: f32,
  b: f32, // Assuming alpha is 1.0, store linear RGB
};

struct Uniforms {
  angle_rad: f32,
  num_stops: u32,
  // Padding to align the start of the array to 16 bytes (vec4f)
  _padding1: f32,
  _padding2: f32, 
  // Use array<Stop> for the stops
  stops: array<Stop, MAX_STOPS>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

// Simple vertex shader for a fullscreen triangle (no vertex buffer needed)
struct VertexOutput {
  @builtin(position) clip_position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs_main(@builtin(vertex_index) in_vertex_index: u32) -> VertexOutput {
  var output: VertexOutput;
  // Generate a fullscreen triangle covering NDC -1 to +1
  let pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f( 3.0, -1.0),
    vec2f(-1.0,  3.0)
  );
  output.clip_position = vec4f(pos[in_vertex_index], 0.0, 1.0);
  // Map position to UV coords (0-1)
  output.uv = (pos[in_vertex_index] + vec2f(1.0, 1.0)) * 0.5;
  output.uv.y = 1.0 - output.uv.y; // Flip Y for typical texture coords
  return output;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  // Calculate the global interpolation factor 't' based on angle and UV
  let angle_vec = vec2f(cos(u.angle_rad), sin(u.angle_rad));
  let t = clamp(dot(in.uv - vec2f(0.5), angle_vec) + 0.5, 0.0, 1.0);

  // Ensure we have at least two stops to interpolate between
  if (u.num_stops < 2u) {
      // Return first stop color or a default if no stops
      if (u.num_stops == 1u) {
          return vec4f(u.stops[0].r, u.stops[0].g, u.stops[0].b, 1.0);
      } else {
          return vec4f(0.0, 0.0, 0.0, 1.0); // Default black
      }
  }

  // Find the two stops surrounding 't'
  var stop_a: Stop = u.stops[0];
  var stop_b: Stop = u.stops[1];
  for (var i = 0u; i < u.num_stops - 1u; i = i + 1u) {
      if (t >= u.stops[i].pos && t < u.stops[i+1u].pos) {
          stop_a = u.stops[i];
          stop_b = u.stops[i+1u];
          break;
      }
      // If t is beyond the last stop's position, use the last two stops
      if (i == u.num_stops - 2u) { // Check if we are at the last possible pair
           stop_a = u.stops[i];
           stop_b = u.stops[i+1u];
      }
  }
  
  // Handle cases where t might be exactly 1.0 or outside range due to clamping/precision
  if (t >= u.stops[u.num_stops - 1u].pos) {
      stop_a = u.stops[u.num_stops - 2u];
      stop_b = u.stops[u.num_stops - 1u];
  }

  // Calculate local interpolation factor within the chosen stop segment
  let segment_length = stop_b.pos - stop_a.pos;
  var local_t: f32 = 0.0;
  if (segment_length > 0.00001) { // Avoid division by zero
      local_t = clamp((t - stop_a.pos) / segment_length, 0.0, 1.0);
  }
  
  // Interpolate color in linear RGB
  let color_a = vec3f(stop_a.r, stop_a.g, stop_a.b);
  let color_b = vec3f(stop_b.r, stop_b.g, stop_b.b);
  let final_color = mix(color_a, color_b, local_t);

  return vec4f(final_color, 1.0);
} 