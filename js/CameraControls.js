/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author rozifus / http://github.com/rozifus
 */

THREE.CameraControls = function ( camera , domElement ) {

    this.camera = camera;
    this.domElement = ( domElement !== undefined ) ? domElement : document;
    this.projector = new THREE.Projector();

    // API

    this.enabled = true;

    this.tweens = [];

    this.center = new THREE.Vector3();

    this.tweenTime = 1.5;

    this.cameraOffset = new THREE.Vector3(0,0,200);

    this.userZoom = true;
    this.userZoomSpeed = 1.0;

    this.userRotate = true;
    this.userRotateSpeed = 1.0;

    this.userPan = true;
    this.userPanSpeed = 15.0;

    this.autoRotate = false;
    this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

    this.minPolarAngle = 0; // radians
    this.maxPolarAngle = Math.PI; // radians

    this.minDistance = 0;
    this.maxDistance = Infinity;

    this.boostMinDist = 0;
    this.boostMaxDist = 0;

    // 65 /*A*/, 83 /*S*/, 68 /*D*/
    this.keys = {
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        BOTTOM: 40,

        W: 87,
        S: 83,
        A: 65,
        D: 68,
        E: 69,
        Q: 81,

        ROTATE: 65,
        ZOOM: 83,
        PAN: 68
    };
    // internals

    var scope = this;

    var EPS = 0.000001;
    var PIXELS_PER_ROUND = 1800;

    var rotateStart = new THREE.Vector2();
    var rotateEnd = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();

    var zoomStart = new THREE.Vector2();
    var zoomEnd = new THREE.Vector2();
    var zoomDelta = new THREE.Vector2();

    var phiDelta = 0;
    var thetaDelta = 0;
    var scale = 1;

    var lastPosition = new THREE.Vector3();

    var STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2, MOVE_TO: 3 };
    var state = STATE.NONE;

    // events

    var changeEvent = { type: 'change' };

    this.rotateLeft = function ( angle ) {

        if ( angle === undefined ) {

            angle = getAutoRotationAngle();

        }

        thetaDelta -= angle;

    };

    this.rotateRight = function ( angle ) {

        if ( angle === undefined ) {

            angle = getAutoRotationAngle();

        }

        thetaDelta += angle;

    };

    this.rotateUp = function ( angle ) {

        if ( angle === undefined ) {

            angle = getAutoRotationAngle();

        }

        phiDelta -= angle;

    };

    this.rotateDown = function ( angle ) {

        if ( angle === undefined ) {

            angle = getAutoRotationAngle();

        }

        phiDelta += angle;

    };

    this.zoomIn = function ( zoomScale ) {

        if ( zoomScale === undefined ) {

            zoomScale = getZoomScale();

        }

        scale /= zoomScale;

    };

    this.zoomOut = function ( zoomScale ) {

        if ( zoomScale === undefined ) {

            zoomScale = getZoomScale();

        }

        scale *= zoomScale;

    };

    this.pan = function ( distance ) {

        distance.transformDirection( this.camera.matrix );
        distance.multiplyScalar( scope.userPanSpeed );

        this.camera.position.add( distance );
        this.center.add( distance );

    };

    this.update = function () {

        this.updateTweens();

        var position = this.camera.position;
        var offset = position.clone().sub( this.center );

        // angle from z-axis around y-axis

        var theta = Math.atan2( offset.x, offset.z );

        // angle from y-axis

        var phi = Math.atan2( Math.sqrt( offset.x * offset.x + offset.z * offset.z ), offset.y );

        if ( this.autoRotate ) {

            this.rotateLeft( getAutoRotationAngle() );

        }

        theta += thetaDelta;
        phi += phiDelta;

        // restrict phi to be between desired limits
        phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, phi ) );

        // restrict phi to be betwee EPS and PI-EPS
        phi = Math.max( EPS, Math.min( Math.PI - EPS, phi ) );

        var radius = offset.length() * scale;

        // restrict radius to be between desired limits
        radius = Math.max( this.minDistance, Math.min( this.maxDistance, radius ) );

        offset.x = radius * Math.sin( phi ) * Math.sin( theta );
        offset.y = radius * Math.cos( phi );
        offset.z = radius * Math.sin( phi ) * Math.cos( theta );

        position.copy( this.center ).add( offset );

        this.camera.lookAt( this.center );

        thetaDelta = 0;
        phiDelta = 0;
        scale = 1;

        if ( lastPosition.distanceTo( this.camera.position ) > 0 ) {

            this.dispatchEvent( changeEvent );

            lastPosition.copy( this.camera.position );

        }

    };

    this.updateTweens = function() {
        if (this.tweens.length <= 0) return;

        for (var tI = 0; tI < this.tweens.length; tI += 1) {
            var tween = this.tweens[tI];

            var otod = tween.destination.clone().sub(tween.origin);
            var step = otod.clone().multiplyScalar(delta/this.tweenTime);
            var distanceToDest = tween.destination.clone().sub(tween.target);

            if (typeof(tween.delta) == "undefined") {
                tween.delta = 0;
            }
            tween.delta += delta;

            if (distanceToDest.length() <= step.length() ||
                tween.delta > (1.01 * this.tweenTime)) {
                tween.target.copy(tween.destination);
                this.tweens[tI] = null;
            } else {
                tween.target.add(step);
            };
        };

        this.tweens = this.tweens.filter(function(val) { return val != null });

    }

    function getAutoRotationAngle() {

        return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

    }

    function getZoomScale() {

        return Math.pow( 0.95, scope.userZoomSpeed );

    }

    function setupMoveTo( x, y ) {

        var vector = new THREE.Vector3( ( x / window.innerWidth ) * 2 - 1, - ( y / window.innerHeight ) * 2 + 1, 0.5 );

        scope.projector.unprojectVector( vector, camera );

        var raycaster = new THREE.Raycaster( camera.position, vector.sub( camera.position ).normalize() );
        var intersects = raycaster.intersectObjects( wordobjects );

        if ( intersects.length > 0 ) {

            var wordNode = intersects[0].object

            scope.tweens.push({ origin: scope.center.clone(),
                                destination: wordNode.position.clone(),
                                target: scope.center });

            scope.tweens.push({ origin: scope.camera.position.clone(),
                                destination: wordNode.position.clone().add(scope.cameraOffset),
                                target: scope.camera.position });
            //wordnav( intersects[0].object.meta.word )

        }
    };

    function onMouseDown( event ) {

        if ( scope.enabled === false ) return;
        if ( scope.userRotate === false ) return;
        if ( scope.tweens.length > 0 ) return;

        event.preventDefault();

        if ( state === STATE.NONE )
        {
            if ( event.button === 0 )
                state = STATE.MOVE_TO;
            if ( event.button === 1 )
                state = STATE.PAN;
            if ( event.button === 2 )
                state = STATE.ROTATE;
        }


        if ( state === STATE.ROTATE ) {

            //state = STATE.ROTATE;

            rotateStart.set( event.clientX, event.clientY );

        } else if ( state === STATE.ZOOM ) {

            //state = STATE.ZOOM;

            zoomStart.set( event.clientX, event.clientY );

        } else if ( state === STATE.PAN ) {

            //state = STATE.PAN;

        } else if ( state === STATE.MOVE_TO ) {

            //state = STATE.MOVE_TO;
            setupMoveTo( event.clientX, event.clientY );

        }

        document.addEventListener( 'mousemove', onMouseMove, false );
        document.addEventListener( 'mouseup', onMouseUp, false );

    }

    function onMouseMove( event ) {

        if ( scope.enabled === false ) return;

        event.preventDefault();



        if ( state === STATE.ROTATE ) {

            rotateEnd.set( event.clientX, event.clientY );
            rotateDelta.subVectors( rotateEnd, rotateStart );

            scope.rotateLeft( 2 * Math.PI * rotateDelta.x / PIXELS_PER_ROUND * scope.userRotateSpeed );
            scope.rotateUp( 2 * Math.PI * rotateDelta.y / PIXELS_PER_ROUND * scope.userRotateSpeed );

            rotateStart.copy( rotateEnd );

        } else if ( state === STATE.ZOOM ) {

            zoomEnd.set( event.clientX, event.clientY );
            zoomDelta.subVectors( zoomEnd, zoomStart );

            if ( zoomDelta.y > 0 ) {

                scope.zoomIn();

            } else {

                scope.zoomOut();

            }

            zoomStart.copy( zoomEnd );

        } else if ( state === STATE.PAN ) {

            var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

            scope.pan( new THREE.Vector3( - movementX, movementY, 0 ) );

        }

    }

    function onMouseUp( event ) {

        if ( scope.enabled === false ) return;
        if ( scope.userRotate === false ) return;

        document.removeEventListener( 'mousemove', onMouseMove, false );
        document.removeEventListener( 'mouseup', onMouseUp, false );

        state = STATE.NONE;

    }

    function onMouseWheel( event ) {

        if ( scope.enabled === false ) return;
        if ( scope.userZoom === false ) return;

        var delta = 0;

        if ( event.wheelDelta ) { // WebKit / Opera / Explorer 9

            delta = event.wheelDelta;

        } else if ( event.detail ) { // Firefox

            delta = - event.detail;

        }

        if ( delta > 0 ) {

            scope.zoomOut();

        } else {

            scope.zoomIn();

        }

    }

    function onKeyDown( event ) {

        if ( scope.enabled === false ) return;
        if ( scope.userPan === false ) return;

        switch ( event.keyCode ) {

            case scope.keys.UP:
                scope.pan( new THREE.Vector3( 0, 1, 0 ) );
                break;
            case scope.keys.BOTTOM:
                scope.pan( new THREE.Vector3( 0, - 1, 0 ) );
                break;
            case scope.keys.LEFT:
                scope.pan( new THREE.Vector3( - 1, 0, 0 ) );
                break;
            case scope.keys.RIGHT:
                scope.pan( new THREE.Vector3( 1, 0, 0 ) );
                break;

            case scope.keys.W:
                scope.pan( new THREE.Vector3( 0, 0, -1) );
                break;
            case scope.keys.S:
                scope.pan( new THREE.Vector3( 0, 0, 1 ) );
                break;
            case scope.keys.A:
                scope.pan( new THREE.Vector3( - 1, 0, 0 ) );
                break;
            case scope.keys.D:
                scope.pan( new THREE.Vector3( 1, 0, 0 ) );
                break;
            case scope.keys.Q:
                scope.pan( new THREE.Vector3( 0, -1, 0 ) );
                break;
            case scope.keys.E:
                scope.pan( new THREE.Vector3( 0, 1, 0 ) );
                break;

            case scope.keys.ROTATE:
                state = STATE.ROTATE;
                break;
            case scope.keys.ZOOM:
                state = STATE.ZOOM;
                break;
            case scope.keys.PAN:
                state = STATE.PAN;
                break;

        }

    }

    function onKeyUp( event ) {

        switch ( event.keyCode ) {

            case scope.keys.ROTATE:
            case scope.keys.ZOOM:
            case scope.keys.PAN:
                state = STATE.NONE;
                break;
        }

    }

    this.domElement.addEventListener( 'contextmenu', function ( event ) { event.preventDefault(); }, false );
    this.domElement.addEventListener( 'mousedown', onMouseDown, false );
    this.domElement.addEventListener( 'mousewheel', onMouseWheel, false );
    this.domElement.addEventListener( 'DOMMouseScroll', onMouseWheel, false ); // firefox
    window.addEventListener( 'keydown', onKeyDown, false );
    window.addEventListener( 'keyup', onKeyUp, false );

};

THREE.CameraControls.prototype = Object.create( THREE.EventDispatcher.prototype );
