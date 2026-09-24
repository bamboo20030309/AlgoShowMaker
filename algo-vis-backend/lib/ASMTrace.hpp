#ifndef ASM_TRACE_HPP
#define ASM_TRACE_HPP

#include <algorithm>
#include <array>
#include <cstdlib>
#include <deque>
#include <fstream>
#include <iomanip>
#include <list>
#include <map>
#include <queue>
#include <set>
#include <sstream>
#include <stack>
#include <string>
#include <tuple>
#include <type_traits>
#include <typeinfo>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

namespace asm_trace {

inline std::string escape(const std::string& value) {
  std::ostringstream out;
  for (unsigned char ch : value) {
    switch (ch) {
      case '"': out << "\\\""; break;
      case '\\': out << "\\\\"; break;
      case '\b': out << "\\b"; break;
      case '\f': out << "\\f"; break;
      case '\n': out << "\\n"; break;
      case '\r': out << "\\r"; break;
      case '\t': out << "\\t"; break;
      default:
        if (ch < 0x20) {
          out << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(ch) << std::dec;
        } else {
          out << ch;
        }
    }
  }
  return out.str();
}

inline std::string quoted(const std::string& value) {
  return std::string("\"") + escape(value) + "\"";
}

template <typename T>
typename std::enable_if<std::is_same<T, bool>::value, std::string>::type encode_scalar(const T& value) {
  return value ? "true" : "false";
}

template <typename T>
typename std::enable_if<std::is_arithmetic<T>::value && !std::is_same<T, bool>::value, std::string>::type encode_scalar(const T& value) {
  std::ostringstream out;
  out << std::setprecision(17) << value;
  return out.str();
}

inline std::string encode_scalar(const char& value) { return quoted(std::string(1, value)); }
inline std::string encode_scalar(const signed char& value) { return std::to_string(static_cast<int>(value)); }
inline std::string encode_scalar(const unsigned char& value) { return std::to_string(static_cast<unsigned int>(value)); }
inline std::string encode_scalar(const std::string& value) { return quoted(value); }
inline std::string encode_scalar(const char* value) { return quoted(value ? value : ""); }

template <typename T>
typename std::enable_if<std::is_arithmetic<T>::value, std::string>::type encode_value(const T& value) {
  return std::string("{\"kind\":\"scalar\",\"value\":") + encode_scalar(value) + "}";
}

inline std::string encode_value(const std::string& value) {
  return std::string("{\"kind\":\"string\",\"value\":") + quoted(value) + "}";
}

inline std::string encode_value(const char* value) {
  return encode_value(std::string(value ? value : ""));
}

template <typename T>
typename std::enable_if<!std::is_arithmetic<T>::value && !std::is_pointer<T>::value, std::string>::type
encode_value(const T& value);

template <typename T, typename Alloc>
std::string encode_value(const std::vector<T, Alloc>& value);
template <typename T, typename Alloc>
std::string encode_value(const std::deque<T, Alloc>& value);
template <typename T, typename Alloc>
std::string encode_value(const std::list<T, Alloc>& value);
template <typename T, std::size_t N>
std::string encode_value(const std::array<T, N>& value);
template <typename T, std::size_t N>
std::string encode_value(const T (&value)[N]);
template <typename A, typename B>
std::string encode_value(const std::pair<A, B>& value);
template <typename... T>
std::string encode_value(const std::tuple<T...>& value);

template <typename Iterator>
std::string encode_sequence(Iterator begin, Iterator end, const char* kind = "sequence") {
  std::ostringstream out;
  out << "{\"kind\":" << quoted(kind) << ",\"items\":[";
  bool first = true;
  for (Iterator it = begin; it != end; ++it) {
    if (!first) out << ',';
    first = false;
    out << encode_value(*it);
  }
  out << "]}";
  return out.str();
}

template <typename T, typename Alloc>
std::string encode_value(const std::vector<T, Alloc>& value) { return encode_sequence(value.begin(), value.end()); }

template <typename T, typename Alloc>
std::string encode_value(const std::deque<T, Alloc>& value) { return encode_sequence(value.begin(), value.end()); }

template <typename T, typename Alloc>
std::string encode_value(const std::list<T, Alloc>& value) { return encode_sequence(value.begin(), value.end()); }

template <typename T, std::size_t N>
std::string encode_value(const std::array<T, N>& value) { return encode_sequence(value.begin(), value.end()); }

template <typename T, std::size_t N>
std::string encode_value(const T (&value)[N]) { return encode_sequence(value, value + N); }

template <typename T, typename Compare, typename Alloc>
std::string encode_value(const std::set<T, Compare, Alloc>& value) { return encode_sequence(value.begin(), value.end(), "set"); }

template <typename T, typename Hash, typename Equal, typename Alloc>
std::string encode_value(const std::unordered_set<T, Hash, Equal, Alloc>& value) { return encode_sequence(value.begin(), value.end(), "set"); }

template <typename A, typename B>
std::string encode_value(const std::pair<A, B>& value) {
  return std::string("{\"kind\":\"pair\",\"items\":[") + encode_value(value.first) + ',' + encode_value(value.second) + "]}";
}

template <typename Tuple, std::size_t... I>
std::string encode_tuple(const Tuple& value, std::index_sequence<I...>) {
  std::ostringstream out;
  out << "{\"kind\":\"tuple\",\"items\":[";
  std::size_t index = 0;
  ((out << (index++ ? "," : "") << encode_value(std::get<I>(value))), ...);
  out << "]}";
  return out.str();
}

template <typename... T>
std::string encode_value(const std::tuple<T...>& value) {
  return encode_tuple(value, std::index_sequence_for<T...>{});
}

template <typename Iterator>
std::string encode_map(Iterator begin, Iterator end) {
  std::ostringstream out;
  out << "{\"kind\":\"map\",\"entries\":[";
  bool first = true;
  for (Iterator it = begin; it != end; ++it) {
    if (!first) out << ',';
    first = false;
    out << "{\"key\":" << encode_value(it->first) << ",\"value\":" << encode_value(it->second) << '}';
  }
  out << "]}";
  return out.str();
}

template <typename K, typename V, typename Compare, typename Alloc>
std::string encode_value(const std::map<K, V, Compare, Alloc>& value) { return encode_map(value.begin(), value.end()); }

template <typename K, typename V, typename Hash, typename Equal, typename Alloc>
std::string encode_value(const std::unordered_map<K, V, Hash, Equal, Alloc>& value) { return encode_map(value.begin(), value.end()); }

template <typename T, typename Container>
std::string encode_value(std::stack<T, Container> value) {
  std::vector<T> items;
  while (!value.empty()) { items.push_back(value.top()); value.pop(); }
  std::reverse(items.begin(), items.end());
  return encode_sequence(items.begin(), items.end(), "stack");
}

template <typename T, typename Container>
std::string encode_value(std::queue<T, Container> value) {
  std::vector<T> items;
  while (!value.empty()) { items.push_back(value.front()); value.pop(); }
  return encode_sequence(items.begin(), items.end(), "queue");
}

template <typename T>
std::string encode_value(T* const& value) {
  std::ostringstream address;
  if (value) address << static_cast<const void*>(value);
  return std::string("{\"kind\":\"reference\",\"address\":")
    + quoted(value ? address.str() : "null") + '}';
}

template <typename T>
typename std::enable_if<!std::is_arithmetic<T>::value && !std::is_pointer<T>::value, std::string>::type encode_opaque(const T& value) {
  std::ostringstream address;
  address << static_cast<const void*>(&value);
  return std::string("{\"kind\":\"object\",\"type\":") + quoted(typeid(T).name())
    + ",\"identity\":" + quoted(address.str()) + ",\"fields\":{}}";
}

template <typename T>
typename std::enable_if<!std::is_arithmetic<T>::value && !std::is_pointer<T>::value, std::string>::type
encode_value(const T& value) { return encode_opaque(value); }

struct NamedValue {
  std::string id;
  std::string name;
  std::string identity;
  std::string lifetime;
  std::string json;
};

inline std::string current_activation_source_json();
inline std::string current_loop_source_json();
inline unsigned long long& trace_position() { static unsigned long long value = 0; return value; }

inline std::unordered_map<std::string, std::vector<std::string>>& active_lifetimes() {
  static std::unordered_map<std::string, std::vector<std::string>> values;
  return values;
}

inline std::unordered_set<std::string>& uninitialized_variable_keys() {
  static std::unordered_set<std::string> values;
  return values;
}

inline unsigned long long& lifetime_counter() {
  static unsigned long long value = 0;
  return value;
}

template <typename T>
std::string lifetime_key(const char* variable_id, const T& value) {
  std::ostringstream address;
  address << static_cast<const void*>(&value);
  return std::string(variable_id ? variable_id : "") + '\x1f' + address.str();
}

template <typename T>
std::string current_lifetime(const char* variable_id, const T& value) {
  const auto key = lifetime_key(variable_id, value);
  const auto found = active_lifetimes().find(key);
  return found == active_lifetimes().end() || found->second.empty()
    ? std::string()
    : found->second.back();
}

template <typename T>
void mark_initialized(const char* variable_id, const T& value) {
  uninitialized_variable_keys().erase(lifetime_key(variable_id, value));
}

template <typename T>
NamedValue named(const char* id, const char* name, const T& value) {
  std::ostringstream address;
  address << static_cast<const void*>(&value);
  const std::string lifetime = current_lifetime(id, value);
  const bool uninitialized = uninitialized_variable_keys().find(lifetime_key(id, value))
    != uninitialized_variable_keys().end();
  return NamedValue{
    id ? id : "", name ? name : "", address.str(),
    lifetime,
    uninitialized ? std::string("{\"kind\":\"scalar\",\"value\":\"\"}") : encode_value(value)
  };
}

class Recorder {
 public:
  Recorder() : event_id_(0), frame_id_(0), enabled_(false), max_frames_(5000) {
    const char* path = std::getenv("ASM_TRACE_FILE");
    if (!path || !*path) return;
    const char* max_frames = std::getenv("ASM_TRACE_MAX_FRAMES");
    if (max_frames) max_frames_ = std::max(1, std::atoi(max_frames));
    output_.open(path, std::ios::out | std::ios::trunc);
    enabled_ = output_.is_open();
    if (enabled_) output_ << "{\"record\":\"meta\",\"schemaVersion\":\"1.0\"}\n";
  }

  bool enabled() const { return enabled_; }
  void loop_record(const std::string& fields) {
    if (!enabled_ || frame_id_ >= max_frames_) return;
    output_ << "{\"record\":\"loop\",\"position\":" << trace_position()++ << ',' << fields << "}\n";
    output_.flush();
  }

  std::string add_event(const std::string& type, int line, const std::string& signature,
                        const std::string& fields = std::string()) {
    if (!enabled_ || frame_id_ >= max_frames_) return std::string();
    const int execution_order = event_id_++;
    const std::string event_id = std::string("event-") + std::to_string(execution_order);
    std::ostringstream event;
    event << "{\"id\":" << quoted(event_id)
          << ",\"order\":" << execution_order
          << ",\"type\":" << quoted(type)
          << ",\"signature\":" << quoted(signature)
          << ",\"line\":" << line;
    if (!fields.empty()) event << ',' << fields;
    if (fields.find("\"recursionActivationId\"") == std::string::npos) {
      event << current_activation_source_json();
    }
    event << '}';
    pending_events_.push_back(event.str());
    return event_id;
  }

  template <typename... Values>
  void capture(int line, const char* function_name, const char* statement_id,
               const char* statement_kind, const Values&... values) {
    if (!enabled_ || frame_id_ >= max_frames_) return;
    std::vector<NamedValue> state{ values... };
    output_ << "{\"record\":\"frame\",\"id\":" << quoted(std::string("frame-") + std::to_string(frame_id_++))
            << ",\"source\":{\"line\":" << line
            << ",\"function\":" << quoted(function_name ? function_name : "")
            << ",\"statementId\":" << quoted(statement_id ? statement_id : "")
            << ",\"statementKind\":" << quoted(statement_kind ? statement_kind : "")
            << current_activation_source_json() << current_loop_source_json()
            << ",\"tracePosition\":" << trace_position()++ << "}"
            << ",\"state\":{";
    for (std::size_t index = 0; index < state.size(); ++index) {
      if (index) output_ << ',';
      output_ << quoted(state[index].id) << ":{\"name\":" << quoted(state[index].name)
              << ",\"identity\":" << quoted(state[index].identity)
              << ",\"lifetime\":" << quoted(state[index].lifetime)
              << ",\"data\":" << state[index].json << '}';
    }
    output_ << "},\"events\":[";
    for (std::size_t index = 0; index < pending_events_.size(); ++index) {
      if (index) output_ << ',';
      output_ << pending_events_[index];
    }
    output_ << "]}\n";
    output_.flush();
    pending_events_.clear();
  }

 private:
  std::ofstream output_;
  std::vector<std::string> pending_events_;
  int event_id_;
  int frame_id_;
  bool enabled_;
  int max_frames_;
};

inline Recorder& recorder() {
  static Recorder instance;
  return instance;
}

struct FunctionActivationFrame {
  std::string function_name;
  std::string activation_id;
  std::string parent_activation_id;
  std::string invoked_by_call_event_id;
  std::vector<std::string> ancestor_activation_ids;
  int recursion_depth;
  int sibling_index;
  int root_index;
  int next_recursive_child;
};

struct CallInvocationFrame {
  std::string event_id;
  std::string callee;
  std::string callee_activation_id;
};

inline std::vector<CallInvocationFrame>& call_invocation_stack() {
  static std::vector<CallInvocationFrame> stack;
  return stack;
}

inline bool call_callee_matches_function(const std::string& callee, const std::string& function_name) {
  if (callee == function_name) return true;
  if (callee.size() <= function_name.size()) return false;
  const std::size_t offset = callee.size() - function_name.size();
  if (callee.compare(offset, function_name.size(), function_name) != 0) return false;
  return callee.compare(offset >= 2 ? offset - 2 : offset, 2, "::") == 0
    || callee.compare(offset >= 2 ? offset - 2 : offset, 2, "->") == 0
    || callee[offset - 1] == '.';
}

inline std::vector<FunctionActivationFrame>& function_activation_stack() {
  static std::vector<FunctionActivationFrame> stack;
  return stack;
}

inline unsigned long long& function_activation_counter() {
  static unsigned long long value = 0;
  return value;
}

inline std::unordered_map<std::string, int>& function_root_counters() {
  static std::unordered_map<std::string, int> values;
  return values;
}

struct LoopContext { std::string id; std::string instance; int ordinal; };
inline std::vector<LoopContext>& loop_stack() { static std::vector<LoopContext> stack; return stack; }
inline std::string current_loop_source_json() {
  std::ostringstream json;
  json << ",\"loopContext\":[";
  for (std::size_t i = 0; i < loop_stack().size(); ++i) {
    if (i) json << ',';
    const auto& loop = loop_stack()[i];
    json << "{\"loopId\":" << ::asm_trace::quoted(loop.id) << ",\"instanceId\":" << ::asm_trace::quoted(loop.instance)
         << ",\"ordinal\":" << loop.ordinal << '}';
  }
  json << ']'; return json.str();
}
class LoopScope {
 public:
  explicit LoopScope(const char* id) {
    static unsigned long long counter = 0;
    LoopContext loop{ id, "loop-instance-" + std::to_string(counter++), -1 };
    recorder().loop_record(std::string("\"phase\":\"start\",\"loopId\":") + ::asm_trace::quoted(loop.id)
      + ",\"instanceId\":" + ::asm_trace::quoted(loop.instance) + current_activation_source_json() + current_loop_source_json());
    loop_stack().push_back(loop);
  }
  template<typename... Values> void enter(const Values&... values) {
    auto& loop = loop_stack().back(); ++loop.ordinal;
    std::vector<NamedValue> samples{values...};
    std::ostringstream json;
    json << "\"phase\":\"entry\",\"instanceId\":" << ::asm_trace::quoted(loop.instance) << ",\"ordinal\":" << loop.ordinal << ",\"values\":{";
    for (std::size_t i = 0; i < samples.size(); ++i) {
      if (i) json << ',';
      json << ::asm_trace::quoted(samples[i].name) << ':' << samples[i].json;
    }
    json << '}'; recorder().loop_record(json.str());
  }
  ~LoopScope() { loop_stack().pop_back(); }
};

inline std::string current_activation_source_json() {
  const auto& stack = function_activation_stack();
  if (stack.empty()) return std::string();
  const FunctionActivationFrame& frame = stack.back();
  std::ostringstream ancestors;
  ancestors << '[';
  for (std::size_t index = 0; index < frame.ancestor_activation_ids.size(); ++index) {
    if (index) ancestors << ',';
    ancestors << quoted(frame.ancestor_activation_ids[index]);
  }
  ancestors << ']';
  return std::string(",\"recursionFunction\":") + quoted(frame.function_name)
    + ",\"recursionActivationId\":" + quoted(frame.activation_id)
    + ",\"recursionParentActivationId\":" + quoted(frame.parent_activation_id)
    + ",\"invokedByCallEventId\":" + quoted(frame.invoked_by_call_event_id)
    + ",\"recursionAncestorActivationIds\":" + ancestors.str()
    + ",\"recursionDepth\":" + std::to_string(frame.recursion_depth)
    + ",\"recursionSiblingIndex\":" + std::to_string(frame.sibling_index)
    + ",\"recursionRootIndex\":" + std::to_string(frame.root_index);
}

class FunctionActivation {
 public:
  explicit FunctionActivation(const char* function_name) : active_(true) {
    const std::string name = function_name ? function_name : "global";
    auto& stack = function_activation_stack();
    int parent_index = -1;
    for (int index = static_cast<int>(stack.size()) - 1; index >= 0; --index) {
      if (stack[static_cast<std::size_t>(index)].function_name == name) {
        parent_index = index;
        break;
      }
    }

    FunctionActivationFrame frame;
    frame.function_name = name;
    frame.activation_id = std::string("activation-")
      + std::to_string(function_activation_counter()++);
    auto& invocations = call_invocation_stack();
    if (!invocations.empty() && call_callee_matches_function(invocations.back().callee, name)) {
      frame.invoked_by_call_event_id = invocations.back().event_id;
      invocations.back().callee_activation_id = frame.activation_id;
    }
    frame.next_recursive_child = 0;
    if (parent_index >= 0) {
      FunctionActivationFrame& parent = stack[static_cast<std::size_t>(parent_index)];
      frame.parent_activation_id = parent.activation_id;
      frame.ancestor_activation_ids = parent.ancestor_activation_ids;
      frame.ancestor_activation_ids.push_back(parent.activation_id);
      frame.recursion_depth = parent.recursion_depth + 1;
      frame.sibling_index = parent.next_recursive_child++;
      frame.root_index = parent.root_index;
    } else {
      frame.parent_activation_id.clear();
      frame.ancestor_activation_ids.clear();
      frame.recursion_depth = 0;
      frame.sibling_index = 0;
      frame.root_index = function_root_counters()[name]++;
    }
    activation_id_ = frame.activation_id;
    stack.push_back(frame);
  }

  FunctionActivation(const FunctionActivation&) = delete;
  FunctionActivation& operator=(const FunctionActivation&) = delete;

  ~FunctionActivation() {
    if (!active_) return;
    auto& stack = function_activation_stack();
    if (!stack.empty() && stack.back().activation_id == activation_id_) {
      stack.pop_back();
      return;
    }
    for (auto it = stack.end(); it != stack.begin();) {
      --it;
      if (it->activation_id != activation_id_) continue;
      stack.erase(it);
      break;
    }
  }

 private:
  std::string activation_id_;
  bool active_;
};

inline std::string recursion_layout_context_json(const char* layout_id) {
  if (!layout_id || !*layout_id) return std::string();
  const auto& stack = function_activation_stack();
  if (stack.empty()) return std::string();
  const FunctionActivationFrame& frame = stack.back();
  std::ostringstream ancestors;
  ancestors << '[';
  for (std::size_t index = 0; index < frame.ancestor_activation_ids.size(); ++index) {
    if (index) ancestors << ',';
    ancestors << quoted(frame.ancestor_activation_ids[index]);
  }
  ancestors << ']';
  return std::string(",\"layoutId\":") + quoted(layout_id)
    + ",\"recursionFunction\":" + quoted(frame.function_name)
    + ",\"recursionActivationId\":" + quoted(frame.activation_id)
    + ",\"recursionParentActivationId\":" + quoted(frame.parent_activation_id)
    + ",\"recursionAncestorActivationIds\":" + ancestors.str()
    + ",\"recursionDepth\":" + std::to_string(frame.recursion_depth)
    + ",\"recursionSiblingIndex\":" + std::to_string(frame.sibling_index)
    + ",\"recursionRootIndex\":" + std::to_string(frame.root_index);
}

class VariableScopeExit;
inline std::vector<VariableScopeExit*>& active_scope_exit_guards() {
  static std::vector<VariableScopeExit*> guards;
  return guards;
}

class VariableScopeExit {
 public:
  template <typename T>
  VariableScopeExit(int line, const char* signature, const char* variable_id,
                    const char* name, const char* kind, const T& value)
      : line_(line), signature_(signature ? signature : ""),
        variable_id_(variable_id ? variable_id : ""), name_(name ? name : ""),
        kind_(kind ? kind : "object"), key_(lifetime_key(variable_id, value)), active_(true) {
    lifetime_ = std::string("lifetime-") + std::to_string(lifetime_counter()++);
    const auto& activations = function_activation_stack();
    activation_id_ = activations.empty() ? std::string() : activations.back().activation_id;
    active_lifetimes()[key_].push_back(lifetime_);
    active_scope_exit_guards().push_back(this);
  }

  VariableScopeExit(const VariableScopeExit&) = delete;
  VariableScopeExit& operator=(const VariableScopeExit&) = delete;

  ~VariableScopeExit() {
    emit();
    auto& guards = active_scope_exit_guards();
    guards.erase(std::remove(guards.begin(), guards.end(), this), guards.end());
  }

  void emit() {
    if (!active_) return;
    active_ = false;
    recorder().add_event("scope-exit", line_, signature_,
      std::string("\"name\":") + ::asm_trace::quoted(name_)
        + ",\"kind\":" + ::asm_trace::quoted(kind_)
        + ",\"lifetimeIdentity\":" + ::asm_trace::quoted(lifetime_)
        + ",\"targets\":[" + target_json_with_lifetime() + ']');
    uninitialized_variable_keys().erase(key_);
    auto found = active_lifetimes().find(key_);
    if (found == active_lifetimes().end()) return;
    auto& values = found->second;
    for (auto it = values.end(); it != values.begin();) {
      --it;
      if (*it != lifetime_) continue;
      values.erase(it);
      break;
    }
    if (values.empty()) active_lifetimes().erase(found);
  }

  bool belongs_to(const std::string& activation_id) const {
    return activation_id_ == activation_id;
  }

 private:
  std::string target_json_with_lifetime() const {
    return std::string("{\"role\":\"target\",\"variableId\":") + ::asm_trace::quoted(variable_id_)
      + ",\"expression\":" + ::asm_trace::quoted(name_)
      + ",\"indexExpression\":\"\",\"lifetimeIdentity\":" + ::asm_trace::quoted(lifetime_) + '}';
  }

  int line_;
  std::string signature_;
  std::string variable_id_;
  std::string name_;
  std::string kind_;
  std::string key_;
  std::string lifetime_;
  std::string activation_id_;
  bool active_;
};

inline void emit_current_function_scope_exits() {
  const auto& activations = function_activation_stack();
  if (activations.empty()) return;
  const std::string activation_id = activations.back().activation_id;
  auto& guards = active_scope_exit_guards();
  for (auto it = guards.rbegin(); it != guards.rend(); ++it) {
    if ((*it)->belongs_to(activation_id)) (*it)->emit();
  }
}

inline std::string target_json(const char* role, const char* variable_id,
                               const char* expression, const char* index_expression,
                               bool has_resolved_index = false, long long resolved_index = 0) {
  std::string result = std::string("{\"role\":") + quoted(role ? role : "target")
    + ",\"variableId\":" + quoted(variable_id ? variable_id : "")
    + ",\"expression\":" + quoted(expression ? expression : "")
    + ",\"indexExpression\":" + quoted(index_expression ? index_expression : "");
  if (has_resolved_index) result += ",\"resolvedIndex\":" + std::to_string(resolved_index);
  return result + '}';
}

template <typename T>
inline void event_keep(int line, const char* signature, const char* variable_id,
                       const char* name, const char* label, const T& value,
                       bool preserve_style = true, const char* layout_id = "") {
  recorder().add_event("keep", line, signature ? signature : "",
    std::string("\"name\":") + quoted(name ? name : "")
      + ",\"label\":" + quoted(label ? label : "")
      + ",\"mode\":\"variable\""
      + ",\"preserveStyle\":" + (preserve_style ? "true" : "false")
      + recursion_layout_context_json(layout_id)
      + ",\"payload\":{\"data\":" + encode_value(value) + "}"
      + ",\"targets\":[" + target_json("source", variable_id, name, "") + ']');
}

inline void event_keep_last(int line, const char* signature, const char* label,
                            bool preserve_style = true, const char* layout_id = "") {
  recorder().add_event("keep", line, signature ? signature : "",
    std::string("\"label\":") + quoted(label ? label : "")
      + ",\"mode\":\"last\""
      + ",\"preserveStyle\":" + (preserve_style ? "true" : "false")
      + recursion_layout_context_json(layout_id)
      + ",\"targets\":[]");
}

template <typename T>
inline void event_visual_exit(int line, const char* signature, const char* variable_id,
                              const char* name, const char* kind, const T& value) {
  const std::string lifetime = current_lifetime(variable_id, value);
  std::string target = target_json("target", variable_id, name, "");
  target.insert(target.size() - 1,
    std::string(",\"lifetimeIdentity\":") + ::asm_trace::quoted(lifetime));
  recorder().add_event("visual-exit", line, signature ? signature : "",
    std::string("\"name\":") + quoted(name ? name : "")
      + ",\"kind\":" + quoted(kind ? kind : "object")
      + ",\"lifetimeIdentity\":" + ::asm_trace::quoted(lifetime)
      + ",\"manualVisualExit\":true"
      + ",\"targets\":[" + target + ']');
}

inline void event_read(int line, const char* signature, const char* variable_id,
                       const char* expression, const char* index_expression) {
  recorder().add_event("read", line, signature ? signature : "",
    std::string("\"targets\":[") + target_json("target", variable_id, expression, index_expression) + ']');
}

template <typename T>
void event_declare(int line, const char* signature, const char* variable_id,
                   const char* name, const char* kind, const T& value,
                   bool parameter_declaration = false) {
  const std::string lifetime = current_lifetime(variable_id, value);
  std::string target = target_json("target", variable_id, name, "");
  target.insert(target.size() - 1, std::string(",\"lifetimeIdentity\":") + ::asm_trace::quoted(lifetime));
  recorder().add_event("declare", line, signature ? signature : "",
    std::string("\"name\":") + quoted(name ? name : "")
      + ",\"kind\":" + quoted(kind ? kind : "object")
      + ",\"lifetimeIdentity\":" + ::asm_trace::quoted(lifetime)
      + (parameter_declaration ? ",\"parameterDeclaration\":true" : "")
      + ",\"payload\":{\"value\":" + encode_value(value) + "}"
      + ",\"targets\":[" + target + ']');
}

template <typename T>
void event_declare_uninitialized(int line, const char* signature, const char* variable_id,
                                 const char* name, const char* kind, const T& value) {
  const std::string lifetime = current_lifetime(variable_id, value);
  if (std::string(kind ? kind : "") == "scalar") {
    uninitialized_variable_keys().insert(lifetime_key(variable_id, value));
  }
  std::string target = target_json("target", variable_id, name, "");
  target.insert(target.size() - 1, std::string(",\"lifetimeIdentity\":") + ::asm_trace::quoted(lifetime));
  recorder().add_event("declare", line, signature ? signature : "",
    std::string("\"name\":") + quoted(name ? name : "")
      + ",\"kind\":" + quoted(kind ? kind : "object")
      + ",\"lifetimeIdentity\":" + ::asm_trace::quoted(lifetime)
      + ",\"payload\":{\"value\":null}"
      + ",\"targets\":[" + target + ']');
}

template <typename T>
void event_initialized_assign(int line, const char* signature,
                              const char* target_id, const char* target_expression, const char* target_index,
                              bool target_has_resolved_index, long long target_resolved_index,
                              const char* source_id, const char* source_expression, const char* source_index,
                              bool source_has_resolved_index, long long source_resolved_index,
                              const char* expression, const T& value,
                              bool for_initializer = false,
                              bool parameter_initializer = false) {
  mark_initialized(target_id, value);
  const std::string encoded = encode_value(value);
  const std::string lifetime = current_lifetime(target_id, value);
  std::string target = target_json("target", target_id, target_expression, target_index,
    target_has_resolved_index, target_resolved_index);
  target.insert(target.size() - 1, std::string(",\"lifetimeIdentity\":") + ::asm_trace::quoted(lifetime));
  recorder().add_event("assign", line, signature ? signature : "",
    std::string("\"operation\":\"=\"")
      + ",\"animate\":true"
      + ",\"declarationInitializer\":true"
      + ",\"forInitializer\":" + (for_initializer ? "true" : "false")
      + ",\"parameterInitializer\":" + (parameter_initializer ? "true" : "false")
      + ",\"lifetimeIdentity\":" + ::asm_trace::quoted(lifetime)
      + ",\"expression\":" + quoted(expression ? expression : "")
      + ",\"payload\":{\"before\":null,\"after\":" + encoded + ",\"source\":" + encoded + "}"
      + ",\"targets\":[" + target
      + ',' + target_json("source", source_id, source_expression, source_index,
          source_has_resolved_index, source_resolved_index) + ']');
}

template <typename F>
bool event_condition(int line, const char* signature, const char* condition_kind, F evaluate) {
  const bool result = evaluate();
  recorder().add_event("condition", line, signature ? signature : "",
    std::string("\"conditionKind\":") + quoted(condition_kind ? condition_kind : "Condition")
      + ",\"result\":" + (result ? "true" : "false"));
  return result;
}

template <typename F>
void event_write(int line, const char* signature, const char* variable_id,
                 const char* expression, const char* index_expression,
                 bool has_resolved_index, long long resolved_index,
                 const char* operation, F action, bool animate = true) {
  action();
  recorder().add_event("write", line, signature ? signature : "",
    std::string("\"operation\":") + quoted(operation ? operation : "")
      + ",\"animate\":" + (animate ? "true" : "false")
      + ",\"targets\":[" + target_json("target", variable_id, expression, index_expression,
          has_resolved_index, resolved_index) + ']');
}

template <typename Collection, typename F>
void event_sequence_operation(int line, const char* signature,
                              const char* variable_id, const char* expression,
                              const char* operation, Collection& collection, F action) {
  const std::size_t before_size = collection.size();
  const std::string before_front = before_size ? encode_value(collection.front()) : "null";
  const std::string before_back = before_size ? encode_value(collection.back()) : "null";
  action();
  const std::size_t after_size = collection.size();
  const std::string after_front = after_size ? encode_value(collection.front()) : "null";
  const std::string after_back = after_size ? encode_value(collection.back()) : "null";
  recorder().add_event("sequence-operation", line, signature ? signature : "",
    std::string("\"operation\":") + quoted(operation ? operation : "")
      + ",\"payload\":{\"beforeSize\":" + std::to_string(before_size)
      + ",\"afterSize\":" + std::to_string(after_size)
      + ",\"beforeFront\":" + before_front
      + ",\"beforeBack\":" + before_back
      + ",\"afterFront\":" + after_front
      + ",\"afterBack\":" + after_back + "}"
      + ",\"targets\":[" + target_json("target", variable_id, expression, "") + ']');
}

template <typename BeforeFactory, typename F, typename AfterFactory>
void event_update(int line, const char* signature, const char* variable_id,
                   const char* expression, const char* index_expression,
                   bool has_resolved_index, long long resolved_index,
                   const char* operation, BeforeFactory before_factory,
                   F action, AfterFactory after_factory, bool animate = true) {
  const std::string before = encode_value(before_factory());
  action();
  auto&& after_value = after_factory();
  mark_initialized(variable_id, after_value);
  const std::string after = encode_value(after_value);
  recorder().add_event("write", line, signature ? signature : "",
    std::string("\"operation\":") + quoted(operation ? operation : "")
      + ",\"animate\":" + (animate ? "true" : "false")
      + ",\"update\":true"
      + ",\"payload\":{\"before\":" + before + ",\"after\":" + after + ",\"source\":" + after + "}"
      + ",\"targets\":[" + target_json("target", variable_id, expression, index_expression,
          has_resolved_index, resolved_index) + ']');
}

template <typename BeforeFactory, typename F, typename AfterFactory>
void event_compound_assign(
    int line, const char* signature,
    const char* target_id, const char* target_expression, const char* target_index,
    bool target_has_resolved_index, long long target_resolved_index,
    const char* source_id, const char* source_expression, const char* source_index,
    bool source_has_resolved_index, long long source_resolved_index,
    const char* expression, BeforeFactory before_factory, F action,
    AfterFactory after_factory, bool animate = true) {
  const std::string before = encode_value(before_factory());
  action();
  auto&& after_value = after_factory();
  mark_initialized(target_id, after_value);
  const std::string after = encode_value(after_value);
  recorder().add_event("write", line, signature ? signature : "",
    std::string("\"operation\":") + quoted(expression ? expression : "")
      + ",\"expression\":" + quoted(expression ? expression : "")
      + ",\"animate\":" + (animate ? "true" : "false")
      + ",\"compound\":true"
      + ",\"payload\":{\"before\":" + before + ",\"after\":" + after + "}"
      + ",\"targets\":[" + target_json(
          "target", target_id, target_expression, target_index,
          target_has_resolved_index, target_resolved_index)
      + ',' + target_json(
          "source", source_id, source_expression, source_index,
          source_has_resolved_index, source_resolved_index) + ']');
}

template <typename BeforeFactory, typename F, typename AfterFactory>
void event_assign(int line, const char* signature,
                   const char* target_id, const char* target_expression, const char* target_index,
                   bool target_has_resolved_index, long long target_resolved_index,
                   const char* source_id, const char* source_expression, const char* source_index,
                   bool source_has_resolved_index, long long source_resolved_index,
                   const char* expression, BeforeFactory before_factory, F action, AfterFactory after_factory,
                   bool animate = true, bool for_initializer = false) {
  const std::string before = encode_value(before_factory());
  action();
  auto&& after_value = after_factory();
  mark_initialized(target_id, after_value);
  const std::string after = encode_value(after_value);
  recorder().add_event("assign", line, signature ? signature : "",
    std::string("\"operation\":\"=\"")
      + ",\"animate\":" + (animate ? "true" : "false")
      + ",\"forInitializer\":" + (for_initializer ? "true" : "false")
      + ",\"expression\":" + quoted(expression ? expression : "")
      + ",\"payload\":{\"before\":" + before + ",\"after\":" + after + ",\"source\":" + after + "}"
      + ",\"targets\":[" + target_json("target", target_id, target_expression, target_index,
          target_has_resolved_index, target_resolved_index)
      + ',' + target_json("source", source_id, source_expression, source_index,
          source_has_resolved_index, source_resolved_index) + ']');
}

template <typename BeforeFactory, typename F, typename AfterFactory>
void event_binary_assign(
    int line, const char* signature,
    const char* target_id, const char* target_expression, const char* target_index,
    bool target_has_resolved_index, long long target_resolved_index,
    const char* left_id, const char* left_expression, const char* left_index,
    bool left_has_resolved_index, long long left_resolved_index,
    const char* right_id, const char* right_expression, const char* right_index,
    bool right_has_resolved_index, long long right_resolved_index,
    const char* operation, const char* expression,
    BeforeFactory before_factory, F action, AfterFactory after_factory,
    bool animate = true, bool for_initializer = false) {
  const std::string before = encode_value(before_factory());
  action();
  auto&& after_value = after_factory();
  mark_initialized(target_id, after_value);
  const std::string after = encode_value(after_value);
  recorder().add_event("assign", line, signature ? signature : "",
    std::string("\"operation\":\"=\"")
      + ",\"binaryOperation\":" + quoted(operation ? operation : "")
      + ",\"animate\":" + (animate ? "true" : "false")
      + ",\"forInitializer\":" + (for_initializer ? "true" : "false")
      + ",\"expression\":" + quoted(expression ? expression : "")
      + ",\"payload\":{\"before\":" + before + ",\"after\":" + after + "}"
      + ",\"targets\":[" + target_json("target", target_id, target_expression, target_index,
          target_has_resolved_index, target_resolved_index)
      + ',' + target_json("source-left", left_id, left_expression, left_index,
          left_has_resolved_index, left_resolved_index)
      + ',' + target_json("source-right", right_id, right_expression, right_index,
          right_has_resolved_index, right_resolved_index) + ']');
}

// An assignment used as the right-hand side of another assignment must
// preserve its expression value while still recording its own earlier event.
template <typename Action, typename Record>
auto assign_expr_action(Action action, Record record, std::true_type)
    -> decltype(action()) {
  auto&& result = action();
  record();
  return result;
}

template <typename Action, typename Record>
auto assign_expr_action(Action action, Record record, std::false_type)
    -> decltype(action()) {
  auto result = action();
  record();
  return result;
}

template <typename BeforeFactory, typename F, typename AfterFactory>
decltype(auto) event_assign_expr(int line, const char* signature,
                   const char* target_id, const char* target_expression, const char* target_index,
                   bool target_has_resolved_index, long long target_resolved_index,
                   const char* source_id, const char* source_expression, const char* source_index,
                   bool source_has_resolved_index, long long source_resolved_index,
                   const char* expression, BeforeFactory before_factory, F action, AfterFactory after_factory,
                   bool animate = true, bool for_initializer = false) {
  const std::string before = encode_value(before_factory());
  auto record_after = [&]() {
    auto&& after_value = after_factory();
    mark_initialized(target_id, after_value);
    const std::string after = encode_value(after_value);
    recorder().add_event("assign", line, signature ? signature : "",
      std::string("\"operation\":\"=\"")
        + ",\"animate\":" + (animate ? "true" : "false")
        + ",\"forInitializer\":" + (for_initializer ? "true" : "false")
        + ",\"expression\":" + quoted(expression ? expression : "")
        + ",\"payload\":{\"before\":" + before + ",\"after\":" + after + ",\"source\":" + after + "}"
        + ",\"targets\":[" + target_json("target", target_id, target_expression, target_index,
            target_has_resolved_index, target_resolved_index)
        + ',' + target_json("source", source_id, source_expression, source_index,
            source_has_resolved_index, source_resolved_index) + ']');
  };
  return assign_expr_action(action, record_after,
    typename std::is_reference<decltype(action())>::type{});
}

template <typename LeftFactory, typename RightFactory, typename Compare>
bool event_compare(int line, const char* signature,
                   const char* left_id, const char* left_expression, const char* left_index,
                   bool left_has_resolved_index, long long left_resolved_index,
                   const char* right_id, const char* right_expression, const char* right_index,
                   bool right_has_resolved_index, long long right_resolved_index,
                   const char* operation, LeftFactory left_factory, RightFactory right_factory, Compare compare) {
  auto&& left = left_factory();
  auto&& right = right_factory();
  const bool result = compare(left, right);
  recorder().add_event("compare", line, signature ? signature : "",
    std::string("\"operation\":") + quoted(operation ? operation : "")
      + ",\"result\":" + (result ? "true" : "false")
      + ",\"payload\":{\"left\":" + encode_value(left) + ",\"right\":" + encode_value(right) + "}"
      + ",\"targets\":[" + target_json("left", left_id, left_expression, left_index,
          left_has_resolved_index, left_resolved_index)
      + ',' + target_json("right", right_id, right_expression, right_index,
          right_has_resolved_index, right_resolved_index) + ']');
  return result;
}

template <typename ValueFactory>
bool event_truthy_compare(int line, const char* signature,
                          const char* variable_id, const char* expression,
                          const char* index_expression,
                          bool has_resolved_index, long long resolved_index,
                          ValueFactory evaluate) {
  auto&& value = evaluate();
  const bool result = static_cast<bool>(value);
  recorder().add_event("compare", line, signature ? signature : "",
    std::string("\"comparisonKind\":\"truthy\"")
      + ",\"operation\":\"truthy\""
      + ",\"result\":" + (result ? "true" : "false")
      + ",\"payload\":{\"value\":" + encode_value(value) + "}"
      + ",\"targets\":[" + target_json("value", variable_id, expression,
          index_expression, has_resolved_index, resolved_index) + ']');
  return result;
}

template <typename LeftFactory, typename RightFactory, typename F>
void event_swap(int line, const char* signature,
                 const char* left_id, const char* left_expression, const char* left_index,
                 bool left_has_resolved_index, long long left_resolved_index,
                 const char* right_id, const char* right_expression, const char* right_index,
                 bool right_has_resolved_index, long long right_resolved_index,
                 LeftFactory left_factory, RightFactory right_factory, F action) {
  auto&& left = left_factory();
  auto&& right = right_factory();
  const std::string left_before = encode_value(left);
  const std::string right_before = encode_value(right);
  action();
  recorder().add_event("swap", line, signature ? signature : "",
    std::string("\"payload\":{\"leftBefore\":") + left_before
      + ",\"rightBefore\":" + right_before
      + ",\"leftAfter\":" + encode_value(left)
      + ",\"rightAfter\":" + encode_value(right) + "}"
      + ",\"targets\":[" + target_json("left", left_id, left_expression, left_index,
        left_has_resolved_index, left_resolved_index)
      + ',' + target_json("right", right_id, right_expression, right_index,
        right_has_resolved_index, right_resolved_index) + ']');
}

inline void event_call(int line, const char* signature, const char* callee, const char* expression) {
  recorder().add_event("call", line, signature ? signature : "",
    std::string("\"callee\":") + quoted(callee ? callee : "")
      + ",\"expression\":" + quoted(expression ? expression : ""));
}

class CallInvocationScope {
 public:
  CallInvocationScope(int line, const char* signature, const char* callee, const char* expression)
      : line_(line), signature_(signature ? signature : ""),
        callee_(callee ? callee : ""), expression_(expression ? expression : "") {
    event_id_ = recorder().add_event("call", line_, signature_,
      std::string("\"callee\":") + ::asm_trace::quoted(callee_)
        + ",\"expression\":" + ::asm_trace::quoted(expression_));
    call_invocation_stack().push_back({event_id_, callee_, std::string()});
  }

  CallInvocationScope(const CallInvocationScope&) = delete;
  CallInvocationScope& operator=(const CallInvocationScope&) = delete;

  ~CallInvocationScope() {
    auto& stack = call_invocation_stack();
    std::string callee_activation_id;
    if (!stack.empty() && stack.back().event_id == event_id_) {
      callee_activation_id = stack.back().callee_activation_id;
      stack.pop_back();
    }
    recorder().add_event("call-return", line_, signature_,
      std::string("\"callEventId\":") + ::asm_trace::quoted(event_id_)
        + ",\"callee\":" + ::asm_trace::quoted(callee_)
        + ",\"expression\":" + ::asm_trace::quoted(expression_)
        + ",\"calleeActivationId\":" + ::asm_trace::quoted(callee_activation_id));
  }

 private:
  int line_;
  std::string signature_;
  std::string callee_;
  std::string expression_;
  std::string event_id_;
};

template <typename F>
decltype(auto) event_call_invoke(int line, const char* signature,
                                 const char* callee, const char* expression, F&& invoke) {
  CallInvocationScope invocation(line, signature, callee, expression);
  return std::forward<F>(invoke)();
}

template <typename Result, typename Invoke, typename Capture>
typename std::enable_if<!std::is_void<Result>::value, Result>::type
event_return_invoke_result(int line, const char* return_signature,
                           const char* exit_signature, const char* function_name,
                           const char* expression, const std::string& return_event_id,
                           Invoke&& invoke, Capture&& capture) {
  Result result = std::forward<Invoke>(invoke)();
  recorder().add_event("return-complete", line, return_signature ? return_signature : "",
    std::string("\"returnEventId\":") + quoted(return_event_id)
      + ",\"function\":" + quoted(function_name ? function_name : "")
      + ",\"expression\":" + quoted(expression ? expression : "")
      + ",\"payload\":{\"value\":" + encode_value(result) + "}");
  emit_current_function_scope_exits();
  recorder().add_event("function-exit", line, exit_signature ? exit_signature : "",
    std::string("\"function\":") + quoted(function_name ? function_name : "")
      + ",\"returnEventId\":" + quoted(return_event_id));
  std::forward<Capture>(capture)();
  return std::forward<Result>(result);
}

template <typename Result, typename Invoke, typename Capture>
typename std::enable_if<std::is_void<Result>::value, void>::type
event_return_invoke_result(int line, const char* return_signature,
                           const char* exit_signature, const char* function_name,
                           const char* expression, const std::string& return_event_id,
                           Invoke&& invoke, Capture&& capture) {
  std::forward<Invoke>(invoke)();
  recorder().add_event("return-complete", line, return_signature ? return_signature : "",
    std::string("\"returnEventId\":") + quoted(return_event_id)
      + ",\"function\":" + quoted(function_name ? function_name : "")
      + ",\"expression\":" + quoted(expression ? expression : "")
      + ",\"payload\":{\"kind\":\"void\"}");
  emit_current_function_scope_exits();
  recorder().add_event("function-exit", line, exit_signature ? exit_signature : "",
    std::string("\"function\":") + quoted(function_name ? function_name : "")
      + ",\"returnEventId\":" + quoted(return_event_id));
  std::forward<Capture>(capture)();
}

template <typename Invoke, typename Capture>
auto event_return_invoke(int line, const char* return_signature,
                         const char* exit_signature, const char* function_name,
                         const char* expression, Invoke&& invoke, Capture&& capture)
  -> decltype(std::forward<Invoke>(invoke)()) {
  const std::string return_event_id = recorder().add_event("return", line,
    return_signature ? return_signature : "",
    std::string("\"function\":") + quoted(function_name ? function_name : "")
      + ",\"expression\":" + quoted(expression ? expression : ""));
  typedef decltype(std::forward<Invoke>(invoke)()) Result;
  return event_return_invoke_result<Result>(line, return_signature, exit_signature,
    function_name, expression, return_event_id,
    std::forward<Invoke>(invoke), std::forward<Capture>(capture));
}

inline void event_function(int line, const char* signature, const char* function_name, bool entering) {
  recorder().add_event(entering ? "function-enter" : "function-exit", line, signature ? signature : "",
    std::string("\"function\":") + quoted(function_name ? function_name : ""));
}

template <typename... Values>
void capture(int line, const char* function_name, const char* statement_id,
             const char* statement_kind, const Values&... values) {
  recorder().capture(line, function_name, statement_id, statement_kind, values...);
}

}  // namespace asm_trace

#endif
