        // ── D39 prototype scene: the router, its WAN plug, the repair ────────────────────────────────
        // K: frame-local key times; T0: frame-local time of this layer's t = 0.
        var THREE = OE3D.THREE, LED = OE3D.LED, track = OE3D.track;
        var V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
        var R = stage.place('router');
        var wanA = R.world('port_wan'), lanA = R.world('port_lan1');
        var wan = stage.place('plug'), lan = stage.place('plug', { position: [lanA.x, lanA.y, lanA.z] });
        var latch = wan.root.getObjectByName('plug_latch'), LATCH0 = latch ? latch.rotation.x : 0;
        var cw = new OE3D.Cable(stage), cl = new OE3D.Cable(stage);
        // a faint ground grid: the drawing's grid, laid flat, so the space stays one space
        var grid = new THREE.GridHelper(2.4, 60, 0x2a2f3d, 0x2a2f3d); grid.material.transparent = true; grid.material.opacity = 0.35; grid.position.y = -0.0002; stage.scene.add(grid);

        // the face centre and the matched framing (hand-over): long lens, straight on, face where the drawing puts it
        var FACE = V(0, 0.0276, wanA.z), MATCH = MATCH_CFG;
        var visH = 0.159 * 1080 / MATCH.pxW, fov0 = 12, d0 = visH / (2 * Math.tan(fov0 * Math.PI / 360));
        var tyM = FACE.y - (540 - MATCH.cy) * visH / 1080;   // look BELOW the face, so the face sits where the drawing has it (cy 440, above centre)
        var CAM_MATCH = [0, tyM, FACE.z, 0, 0, d0, fov0];
        var CAM_34 = [0.004, 0.022, 0.02, 24, 14, 0.43, 30];
        var CAM_WAN = [wanA.x - 0.004, wanA.y + 0.013, wanA.z + 0.004, 30, 9, 0.134, 30];   // the status row stays clear of the slate

        var notes3 = {
          status: callout('n-status', 'STATUS LIGHTS', 'power · internet · Wi-Fi · LAN', C.text),
          lan: callout('n-lan', 'LAN PORTS', 'the school network', C.text),
          wan: callout('n-wan', 'WAN PORT', 'to the provider', C.primary),
          led: callout('n-led', 'WAN LIGHT: OFF', 'no link', C.neg),
          plug: callout('n-plug', 'CONNECTOR', 'not fully seated', C.neg),
          up: callout('n-up', 'WAN LIGHT: ON', 'link up', C.pos),
        };
        var P = function (v) { return stage.project(v); };
        var mid = function (a, b) { return a.clone().add(b).multiplyScalar(0.5); };

        return function (t) {
          var T = t + T0;
          // ── camera: match → three-quarter → WAN close-up → (repair) → back to the match ──
          var cam = track([[K.orbit0, CAM_MATCH], [K.orbit1, CAM_34, 'power2.inOut'], [K.dolly0, CAM_34], [K.dolly1, CAM_WAN, 'power3.inOut'],
                           [K.back0, CAM_WAN], [K.back1, CAM_MATCH, 'power3.inOut']], T);
          stage.rig({ tx: cam[0], ty: cam[1], tz: cam[2], yaw: cam[3], pitch: cam[4], dist: cam[5], fov: cam[6] });

          // ── the WAN plug: unlatched and sagging (out 6.5 mm, drooping 7°), straightened, pushed home ──
          // (4.5 mm read as "in" at phone size; an unlatched plug does sit further out than that)
          var out = track([[K.seat - 0.7, 0.0065], [K.seat - 0.42, 0.0058, 'power2.out'], [K.seat, 0, 'power3.in']], T);
          var droop = track([[K.seat - 0.7, -7], [K.seat - 0.42, 0, 'power2.inOut']], T);
          wan.root.position.set(wanA.x, wanA.y, wanA.z + out);
          wan.root.rotation.set(droop * Math.PI / 180, 0, 0);
          if (latch) {   // the latch is pressed as it enters, then springs into the notch: the click
            var press = track([[K.seat - 0.3, 0], [K.seat - 0.06, 1, 'power1.in'], [K.seat, 0, 'power4.out']], T);
            latch.rotation.x = LATCH0 * (1 - 0.7 * press);
          }
          // ── cables follow their plugs to the bench, out of the shot ──
          var a = wan.world('cable'), b = lan.world('cable');
          cw.set([a, V(a.x, a.y - 0.001, a.z + 0.018), V(a.x + 0.018, 0.0035, a.z + 0.085), V(0.42, 0.0032, 0.26)]);
          cl.set([b, V(b.x, b.y - 0.001, b.z + 0.018), V(b.x - 0.018, 0.0035, b.z + 0.085), V(-0.42, 0.0032, 0.26)]);

          // ── lights: plausible, never random ──
          R.led('power', LED.POWER_ON); R.led('wifi', LED.POWER_ON); R.led('lan', LED.POWER_ON);
          R.led('lan1', LED.ACTIVITY, T);                                 // the school's traffic on LAN 1
          ['lan2', 'lan3', 'lan4'].forEach(function (p) { R.led(p, LED.LINK_DOWN); });   // nothing plugged in
          var up = Math.min(1, Math.max(0, (T - K.linkUp) / 0.15));      // the link comes up a moment after seating
          R.led('wan', T < K.linkUp + 0.7 ? LED.LINK_UP : LED.ACTIVITY, T, up);
          R.led('internet', T < K.inetTry ? LED.FAULT : T < K.inetOk ? LED.WARNING : LED.POWER_ON);

          // ── callouts, each tied to the thing it names ──
          var st = mid(R.world('led_power'), R.world('led_lan')), ln = mid(R.world('port_lan1'), R.world('port_lan4')), wp = R.world('port_wan'), wl = R.world('led_wan');
          notes3.status.place(P(st.clone().add(V(0, 0.004, 0))), -40, -120, 'end', win(T, K.noteStatus, K.dolly0 + 0.1, 0.3));
          notes3.lan.place(P(ln.clone().add(V(0, -0.006, 0))), -60, 120, 'end', win(T, K.noteLan, K.dolly0 + 0.1, 0.3));
          notes3.wan.place(P(wp.clone().add(V(0, -0.006, 0))), 70, 110, 'start', win(T, K.noteWan, K.dolly0 + 0.1, 0.3));
          notes3.led.place(P(wl), 90, -110, 'start', win(T, K.noteLoose - 0.4, K.linkUp - 0.05, 0.3));
          // the connector note sits beside the plug, clear of the captions
          notes3.plug.place(P(wan.world('tip').clone().add(V(0, -0.004, 0.004))), 300, -20, 'start', win(T, K.noteLoose, K.seat - 0.3, 0.3));
          notes3.up.place(P(wl), 90, -110, 'start', win(T, K.linkUp + 0.1, K.back0 + 0.3, 0.3));

          // ── the layer fades in over the drawing at the match, and out at the match on the way back ──
          root.style.opacity = String(Math.min(Math.min(1, Math.max(0, (T - K.fadeIn) / 0.5)), Math.min(1, Math.max(0, (K.fadeOut + 0.45 - T) / 0.45))));
          stage.render();
        };
